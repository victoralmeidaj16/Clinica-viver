import 'server-only';

import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from './persistence';
import {
  confirmarContato,
  encaminharParaProximo,
  nomeDeExibicao,
  SLA_CONTATO_HORAS,
  type ConfirmacaoResult,
  type ResultadoEncaminhamento,
} from './viverMaisRodizio';
import { COMANDO_CONTATO, COMANDO_ENCAMINHAR, interpretarComando } from './viverMaisComandos';
import { avisarCoordenacao, avisarTransbordo, responderPsicologo } from './viverMaisWhatsApp';
import { avisarAlocacaoPsicologoPorEmail } from './triagemEmail';
import { reconciliarPacientes } from './patientPromotion';
import { normalizeBrazilPhone } from '@/lib/brazilPhone';

export type SituacaoResposta =
  | 'contato_confirmado'
  | 'ja_confirmado'
  | 'encaminhado'
  | 'sem_candidato'
  | 'limite_atingido'
  | 'sem_lead_pendente'
  | 'remetente_desconhecido'
  | 'comando_nao_reconhecido';

export interface ResultadoResposta {
  situacao: SituacaoResposta;
  psicologoId?: string;
  leadId?: string;
  protocolo?: string;
}

/**
 * Compara telefones pelos dígitos que identificam a linha.
 *
 * O WhatsApp devolve o número do jeito dele: com DDI, às vezes sem o nono
 * dígito que o cadastro tem (a operadora acrescentou depois), às vezes com. Uma
 * comparação literal erra exatamente nos números antigos — e errar aqui
 * significa não reconhecer quem respondeu, deixando o SLA correr.
 */
export function mesmoTelefone(a: string | undefined, b: string | undefined): boolean {
  const so = (valor: string | undefined) => (normalizeBrazilPhone(valor) ?? String(valor ?? '')).replace(/\D/g, '');
  const x = so(a);
  const y = so(b);
  if (!x || !y) return false;
  if (x === y) return true;
  // DDD + os 8 dígitos finais: o que sobra depois de tirar DDI e o nono dígito.
  const chave = (numero: string) => {
    const nacional = numero.startsWith('55') ? numero.slice(2) : numero;
    return `${nacional.slice(0, 2)}${nacional.slice(-8)}`;
  };
  return chave(x) === chave(y);
}

/** O lead que a resposta endereça: o mais recente que ainda espera contato. */
function leadPendenteDe(
  leads: readonly TriagemPacienteRecord[],
  psicologoId: string
): TriagemPacienteRecord | undefined {
  return leads
    .filter(
      (lead) =>
        lead.psicologoAlocadoId === psicologoId &&
        lead.status === 'AGUARDANDO_CONTATO' &&
        !lead.confirmadoEm
    )
    .sort((a, b) => (b.alocadoEm ?? '').localeCompare(a.alocadoEm ?? ''))[0];
}

function textoAjuda(psicologo: CadastroPsicologoRecord, lead: TriagemPacienteRecord): string {
  return [
    `${nomeDeExibicao(psicologo)}, não entendi a resposta sobre o protocolo ${lead.protocolo}.`,
    '',
    `Responda *${COMANDO_CONTATO}* se já falou com o paciente.`,
    `Responda *${COMANDO_ENCAMINHAR}* se não for atender — o paciente vai para o próximo profissional da fila.`,
  ].join('\n');
}

/**
 * Processa uma resposta recebida do psicólogo no WhatsApp.
 *
 * Todo o efeito acontece dentro de uma única mutação do repositório, pelas
 * mesmas funções que o link de confirmação e a varredura de SLA usam. O envio
 * das mensagens vem depois, fora da transação: um WhatsApp fora do ar não pode
 * desfazer uma confirmação já gravada.
 */
export async function processarRespostaDoPsicologo(
  telefoneRemetente: string,
  texto: string
): Promise<ResultadoResposta> {
  const comando = interpretarComando(texto);
  const repositorio = getCaptureRepository();
  const estado = await repositorio.read();

  const psicologo = estado.cadastrosPsicologos.find(
    (psi) => psi.status === 'APROVADO' && mesmoTelefone(psi.whatsapp, telefoneRemetente)
  );
  if (!psicologo) return { situacao: 'remetente_desconhecido' };

  const lead = leadPendenteDe(estado.triagensPacientes, psicologo.id);
  if (!lead) return { situacao: 'sem_lead_pendente', psicologoId: psicologo.id };

  if (!comando) {
    void responderPsicologo(psicologo, textoAjuda(psicologo, lead), `ajuda:${lead.id}:${Date.now()}`);
    return {
      situacao: 'comando_nao_reconhecido',
      psicologoId: psicologo.id,
      leadId: lead.id,
      protocolo: lead.protocolo,
    };
  }

  const base = { psicologoId: psicologo.id, leadId: lead.id, protocolo: lead.protocolo };

  if (comando === 'CONTATO') {
    const resultado = await repositorio.mutate<ConfirmacaoResult>((state) => {
      const tratado = confirmarContato(captureStateAsSnapshot(state), lead.id, psicologo.id);
      return {
        next: {
          triagensPacientes: tratado.next.triagensPacientes ?? [],
          cadastrosPsicologos: tratado.next.cadastrosPsicologos ?? [],
        },
        result: tratado.result,
      };
    });

    if (resultado.kind === 'confirmed' || resultado.kind === 'already_confirmed') {
      void responderPsicologo(
        psicologo,
        [
          `Contato registrado para o protocolo ${lead.protocolo}. Obrigado!`,
          '',
          'O paciente agora consta como seu no painel da clínica.',
        ].join('\n'),
        `confirmacao:${lead.id}:${psicologo.id}`
      );
      try {
        await reconciliarPacientes(repositorio);
      } catch (erro) {
        console.error('Contato confirmado pelo WhatsApp; promoção pendente de reconciliação:', erro);
      }
      return {
        ...base,
        situacao: resultado.kind === 'confirmed' ? 'contato_confirmado' : 'ja_confirmado',
      };
    }

    if (resultado.kind === 'capacity_reallocated' || resultado.kind === 'capacity_pending') {
      if (resultado.psicologo) void avisarTransbordo(resultado.lead, resultado.psicologo, nomeDeExibicao(psicologo));
      void responderPsicologo(
        psicologo,
        resultado.kind === 'capacity_reallocated'
          ? `Seu limite de pacientes ativos foi atingido. O protocolo ${lead.protocolo} seguiu para o próximo profissional da fila.`
          : `Seu limite de pacientes ativos foi atingido e não havia outro profissional elegível. O protocolo ${lead.protocolo} voltou para a gestão.`,
        `limite:${lead.id}:${psicologo.id}`
      );
      return { ...base, situacao: 'limite_atingido' };
    }

    // `not_found` e `conflict`: a fila andou entre a leitura e a resposta.
    void responderPsicologo(
      psicologo,
      `O protocolo ${lead.protocolo} não está mais com você — o prazo de ${SLA_CONTATO_HORAS}h venceu e ele seguiu para outro profissional.`,
      `conflito:${lead.id}:${psicologo.id}`
    );
    return { ...base, situacao: 'sem_lead_pendente' };
  }

  const resultado = await repositorio.mutate<ResultadoEncaminhamento>((state) => {
    const tratado = encaminharParaProximo(captureStateAsSnapshot(state), lead.id, psicologo.id);
    return {
      next: {
        triagensPacientes: tratado.snapshot.triagensPacientes ?? [],
        cadastrosPsicologos: tratado.snapshot.cadastrosPsicologos ?? [],
      },
      result: tratado,
    };
  });

  if (resultado.situacao === 'encaminhado' && resultado.lead && resultado.psicologoNovo) {
    // O novo profissional recebe a mesma mensagem de alocação; a coordenação
    // recebe o alerta operacional, como em qualquer troca de responsável.
    void avisarTransbordo(
      resultado.lead,
      resultado.psicologoNovo,
      nomeDeExibicao(psicologo),
      'encaminhamento_voluntario'
    );
    void avisarAlocacaoPsicologoPorEmail(resultado.lead, resultado.psicologoNovo, 'RODIZIO');
    void responderPsicologo(
      psicologo,
      `Certo. O protocolo ${lead.protocolo} foi encaminhado ao próximo profissional da fila e saiu da sua lista.`,
      `encaminhado:${lead.id}:${psicologo.id}`
    );
    return { ...base, situacao: 'encaminhado' };
  }

  if (resultado.situacao === 'sem_candidato') {
    void responderPsicologo(
      psicologo,
      [
        `No momento não há outro profissional que atenda aos critérios do protocolo ${lead.protocolo}.`,
        '',
        'A coordenação foi avisada e vai assumir o caso. Ele continua na sua lista até lá.',
      ].join('\n'),
      `sem-candidato:${lead.id}:${psicologo.id}`
    );
    await avisarCoordenacaoSemCandidato(lead, psicologo);
    return { ...base, situacao: 'sem_candidato' };
  }

  void responderPsicologo(
    psicologo,
    `O protocolo ${lead.protocolo} não está mais aguardando o seu contato.`,
    `nao-aplicavel:${lead.id}:${psicologo.id}`
  );
  return { ...base, situacao: 'sem_lead_pendente' };
}

/**
 * Recusa sem ninguém para receber é o caso que não pode ficar só entre o
 * profissional e o bot: alguém da clínica precisa assumir manualmente.
 */
async function avisarCoordenacaoSemCandidato(
  lead: TriagemPacienteRecord,
  psicologo: CadastroPsicologoRecord
): Promise<void> {
  await avisarCoordenacao(
    [
      'Alerta operacional — encaminhamento sem destino.',
      `Protocolo: ${lead.protocolo}`,
      `${nomeDeExibicao(psicologo)} respondeu ENCAMINHAR e não há outro profissional elegível.`,
      'O caso segue na fila do profissional atual até a coordenação decidir.',
    ].join('\n'),
    `sem-candidato-coord:${lead.id}`
  );
}

import { NextResponse } from 'next/server';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from '@/server/application/persistence';
import {
  captureStateAsSnapshot,
  getCaptureRepository,
} from '@/server/persistence/captureRepository';
import { alocarLead, alocarLeadEscolhido, classificarSla, horasDesdeAlocacao, varrerSla } from '@/server/application/viverMaisRodizio';
import { avisarAlocacao, avisarTransbordo } from '@/server/application/viverMaisWhatsApp';
import { avisarTriagemRecebidaPorEmail } from '@/server/application/triagemEmail';
import { ehGestao, exigirGestao, NaoAutorizadoError } from '@/server/viverMaisGestaoAuth';
import { rateLimited } from '@/server/http/publicRequest';
import {
  LIMITE_CORPO_BYTES,
  TETO_LEADS_POR_HORA,
  leadRecenteDoMesmoTelefone,
  leadsNaUltimaHora,
  validarSubmissaoTriagem,
} from '@/lib/triagemSubmissao';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Desfecho da entrada, decidido dentro da transação que grava a fila. */
type EntradaDeLead =
  | { situacao: 'criado'; lead: TriagemPacienteRecord; psicologo?: CadastroPsicologoRecord }
  | { situacao: 'reenvio'; lead: TriagemPacienteRecord }
  | { situacao: 'escolha_indisponivel' }
  | { situacao: 'teto' };

/**
 * Entrada de lead — pelo formulário público da vitrine ou pelo cadastro manual
 * da gestão.
 *
 * É a única rota de escrita aberta a quem não tem sessão, e cada lead aceito
 * gasta uma vez do rodízio e dispara WhatsApp. As regras de saneamento moram em
 * `lib/triagemSubmissao.ts`; aqui ficam as travas que dependem da requisição —
 * o teto por origem e o tamanho do corpo — e o teto agregado por hora, que
 * precisa ser lido dentro da mesma transação que grava.
 */
export async function POST(request: Request) {
  try {
    // O balde é o mesmo mecanismo das rotas de agenda e pagamento. A gestão
    // passa por cima dele: cadastrar dez leads seguidos que chegaram pelo
    // WhatsApp é trabalho normal de quem atende a clínica, e travar isso seria
    // empurrar a operação de volta para a planilha paralela. Ler a sessão é
    // barato — assinatura do cookie, sem consulta ao banco.
    const gestao = await ehGestao();
    if (!gestao && rateLimited(request, 'triagem-lead', { limite: 8, janelaMs: 10 * 60_000 })) {
      console.warn('[triagem] Limite por origem atingido na entrada de leads.');
      return NextResponse.json(
        { success: false, error: 'Recebemos muitas solicitações deste acesso. Aguarde alguns minutos e tente novamente.' },
        { status: 429, headers: { 'Retry-After': '600' } }
      );
    }

    const bruto = await request.text();
    if (Buffer.byteLength(bruto, 'utf8') > LIMITE_CORPO_BYTES) {
      return NextResponse.json(
        { success: false, error: 'O formulário enviado é grande demais.' },
        { status: 413 }
      );
    }

    let corpo: unknown;
    try {
      corpo = JSON.parse(bruto);
    } catch {
      return NextResponse.json(
        { success: false, error: 'Não foi possível ler os dados enviados.' },
        { status: 400 }
      );
    }

    const validacao = validarSubmissaoTriagem(corpo);
    if (!validacao.ok) {
      return NextResponse.json({ success: false, error: validacao.erro }, { status: validacao.status });
    }
    const dados = validacao.dados;

    // O protocolo é gerado aqui, sempre. Aceitá-lo do cliente — como esta rota
    // fazia — deixava qualquer envio escolher o número que a pessoa leva embora
    // da tela de sucesso, inclusive um já usado por outro lead.
    const novaTriagem: TriagemPacienteRecord = {
      id: `triagem-${Date.now()}`,
      protocolo: `VM-${Math.floor(100000 + Math.random() * 900000)}`,
      nomePaciente: dados.nome,
      telefone: dados.telefone,
      dataNascimento: dados.dataNascimento,
      idade: dados.idade,
      email: dados.email,
      cpf: dados.cpf,
      cep: dados.cep,
      numeroResidencia: dados.numeroResidencia,
      possuiConvenio: dados.possuiConvenio,
      convenioSelecionado: dados.convenioSelecionado,
      origem: dados.origem,
      turno: dados.turno,
      servico: dados.servico,
      servicoKey: dados.servicoKey,
      modalidade: dados.modalidade,
      paraQuemE: dados.paraQuemE,
      especificarNecessidades: dados.especificarNecessidades,
      necessidadesPaciente: dados.necessidadesPaciente,
      necessidadesOutro: dados.necessidadesOutro,
      opcaoAvaliacaoPsicologica: dados.opcaoAvaliacaoPsicologica,
      genero: dados.genero,
      generoOutro: dados.generoOutro,
      status: 'PENDENTE_ATRIBUICAO',
      criadoEm: new Date().toISOString(),
    };

    // A alocação decide dentro da mutação: ler a fila, escolher o profissional
    // da vez e gravar precisam acontecer sem que outro formulário entre no meio
    // — dois pedidos simultâneos alocados a partir da mesma leitura cairiam no
    // mesmo psicólogo. A checagem de reenvio mora aqui pelo mesmo motivo: fora
    // da transação, dois cliques simultâneos passariam os dois.
    const resultado = await getCaptureRepository().mutate<EntradaDeLead>((state) => {
      const snapshot = captureStateAsSnapshot(state);
      const fila = snapshot.triagensPacientes ?? [];

      const jaEnviado = leadRecenteDoMesmoTelefone(fila, dados.telefone);
      if (jaEnviado) {
        return { next: state, result: { situacao: 'reenvio', lead: jaEnviado } };
      }

      if (!gestao && leadsNaUltimaHora(fila) >= TETO_LEADS_POR_HORA) {
        return { next: state, result: { situacao: 'teto' } };
      }

      const comNovoLead = {
        ...snapshot,
        triagensPacientes: [...(snapshot.triagensPacientes ?? []), novaTriagem],
      };
      const alocado = dados.psicologoPreferidoId
        ? alocarLeadEscolhido(comNovoLead, novaTriagem, dados.psicologoPreferidoId)
        : alocarLead(comNovoLead, novaTriagem);

      if (dados.psicologoPreferidoId && !alocado.psicologo) {
        return { next: state, result: { situacao: 'escolha_indisponivel' } };
      }

      return {
        next: {
          triagensPacientes: alocado.snapshot.triagensPacientes ?? [],
          cadastrosPsicologos: alocado.snapshot.cadastrosPsicologos ?? [],
        },
        result: { situacao: 'criado', lead: alocado.lead, psicologo: alocado.psicologo },
      };
    });

    // Aviso depois de gravar, e sem travar a resposta ao paciente: a alocação
    // já está persistida, então uma falha de WhatsApp ou e-mail não perde o lead.
    if (resultado.situacao === 'teto') {
      console.warn(
        `[triagem] Teto de ${TETO_LEADS_POR_HORA} leads/hora atingido; entrada recusada. Verifique se a fila está sendo inundada.`
      );
      return NextResponse.json(
        { success: false, error: 'Estamos recebendo solicitações acima do normal. Tente novamente em alguns minutos ou chame a clínica no WhatsApp.' },
        { status: 429, headers: { 'Retry-After': '900' } }
      );
    }

    if (resultado.situacao === 'escolha_indisponivel') {
      return NextResponse.json(
        { success: false, error: 'Este profissional não está mais disponível para os critérios escolhidos. Selecione outro profissional.' },
        { status: 409 }
      );
    }

    if (resultado.situacao === 'reenvio') {
      console.info(`[triagem] Reenvio do mesmo telefone; devolvido o protocolo ${resultado.lead.protocolo}.`);
    } else if (resultado.psicologo) {
      void avisarAlocacao(resultado.lead, resultado.psicologo);
      void avisarTriagemRecebidaPorEmail(resultado.lead, resultado.psicologo);
    } else {
      console.warn(
        `[triagem] Lead ${novaTriagem.protocolo} sem profissional elegível; aguardando decisão da gestão.`
      );
      void avisarTriagemRecebidaPorEmail(resultado.lead);
    }

    return NextResponse.json({
      success: true,
      protocolo: resultado.lead.protocolo,
      data: resultado.lead,
    });
  } catch (error) {
    console.error('Erro ao salvar triagem de paciente:', error);
    return NextResponse.json({ success: false, error: 'Falha ao salvar no banco.' }, { status: 500 });
  }
}

/**
 * Fila de triagem para o cockpit.
 *
 * A varredura do SLA roda aqui, antes de responder. É o que garante o
 * transbordo funcionando desde o primeiro dia, sem depender de agendador
 * nenhum: quem abre o cockpit paga o custo de manter a fila em dia. Quando um
 * cron for pendurado em `/api/application/triagem/sla-sweep`, os dois convivem
 * — a varredura é idempotente.
 */
export async function GET() {
  try {
    await exigirGestao();

    const varrido = await getCaptureRepository().mutate((state) => {
      const resultado = varrerSla(captureStateAsSnapshot(state));
      return {
        next: {
          triagensPacientes: resultado.snapshot.triagensPacientes ?? [],
          cadastrosPsicologos: resultado.snapshot.cadastrosPsicologos ?? [],
        },
        result: resultado,
      };
    });

    for (const transbordo of varrido.transbordos) {
      void avisarTransbordo(
        transbordo.lead,
        transbordo.psicologoNovo,
        transbordo.psicologoAnteriorNome
      );
    }

    const fila = (varrido.snapshot.triagensPacientes ?? []).map((lead) => ({
      ...lead,
      slaStatus: classificarSla(lead.alocadoEm),
      horasDecorridas: horasDesdeAlocacao(lead.alocadoEm),
    }));

    return NextResponse.json({
      success: true,
      data: fila,
      transbordosExecutados: varrido.transbordos.length,
    });
  } catch (error) {
    if (error instanceof NaoAutorizadoError) {
      return NextResponse.json({ success: false, error: error.message }, { status: error.status });
    }
    console.error('Erro ao listar a fila de triagem:', error);
    return NextResponse.json({ success: false, error: 'Falha ao carregar a fila.' }, { status: 500 });
  }
}

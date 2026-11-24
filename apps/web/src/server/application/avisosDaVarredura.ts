import 'server-only';

import type { RowDataPacket } from 'mysql2';
import { modeloPadrao } from '@/lib/avisos/catalogo';
import { renderizarModelo, type ValoresDoModelo } from '@/lib/avisos/modelo';
import { envioJaRegistrado, registrarEnvioDeAviso } from '@/server/communication/avisosEnviosRepository';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { agendamentosDosPacientes } from '@/server/persistence/mysql/primeiroAgendamento';
import { getContatosDaSessao } from '@/server/scheduling/agendaRepository';
import { quandoPorExtenso, variaveisDaSessao } from '@/server/scheduling/agendaAvisos';
import { proximaAberturaComercial } from '@/server/scheduling/horarioComercial';
import { organizacaoPadrao } from './configuracaoGestao';
import { avisoAtivo, canalDoAviso } from './modelosAvisos';
import { HORAS_ACEITE_SEM_AGENDAMENTO, notificacoesDeAceiteSemAgendamento } from './notificacoes';
import { avisarCoordenacao, enviarTexto } from './viverMaisWhatsApp';

/**
 * Avisos que dependem do relógio, disparados pela varredura periódica.
 *
 * 7.03 e 12.01: o paciente aceito há 48 horas sem primeiro agendamento vira um
 * aviso à Gestão que existe fora do sino — uma linha no registro de envios e,
 * se a Gestão escolheu WhatsApp, uma mensagem aos números da coordenação. O
 * sino continua mostrando o mesmo caso.
 *
 * 12.02: o lembrete da véspera da sessão é complementar e só sai quando a
 * Gestão o ativa.
 */

/** Aceites mais antigos que isto não geram aviso novo: o caso é antigo demais para o alerta ser útil. */
const JANELA_ACEITE_DIAS = 30;

function digitosCoordenacao(): string[] {
  return (process.env.WHATSAPP_COORDINATION_NUMBERS ?? '').split(',').map((n) => n.trim()).filter(Boolean);
}

export async function avisarAceitesSemAgendamento(agora: Date = new Date()): Promise<number> {
  if (!isMysqlConfigured()) return 0;
  const organizationId = organizacaoPadrao();
  const state = await getCaptureRepository().read();
  const limite = agora.getTime() - JANELA_ACEITE_DIAS * 24 * 60 * 60 * 1000;
  const recentes = state.triagensPacientes.filter((lead) => lead.aceitoEm && Date.parse(lead.aceitoEm) >= limite);
  if (!recentes.length) return 0;
  const agendamentos = await agendamentosDosPacientes(organizationId,
    recentes.map((lead) => lead.pacienteRef).filter((ref): ref is string => Boolean(ref)));
  const pendentes = new Set(notificacoesDeAceiteSemAgendamento({ ...state, triagensPacientes: recentes }, agendamentos, agora)
    .map((item) => item.chave.split(':')[1]));

  const canal = (await canalDoAviso('aceite_sem_agendamento_gestao', organizationId)) ?? 'whatsapp';
  let avisados = 0;
  for (const lead of recentes.filter((item) => pendentes.has(item.id))) {
    const chave = `aceite-48h:${lead.id}:${lead.aceitoEm}`;
    if (await envioJaRegistrado(chave)) continue;
    const variaveis: ValoresDoModelo = {
      protocolo: lead.protocolo,
      nome_profissional: lead.psicologoNome ?? 'profissional não identificado',
      aceito_em: quandoPorExtenso(lead.aceitoEm!),
      horas: String(HORAS_ACEITE_SEM_AGENDAMENTO),
    };
    const referencia = `protocolo:${lead.protocolo}`;
    if (canal === 'whatsapp' && digitosCoordenacao().length) {
      await avisarCoordenacao(renderizarModelo(modeloPadrao('aceite_sem_agendamento_gestao'), variaveis), chave,
        'aceite_sem_agendamento_gestao', { variaveis, referencia });
    } else {
      // Sem WhatsApp escolhido ou sem número da coordenação: o aviso existe no painel e no registro.
      await registrarEnvioDeAviso({ finalidade: 'aceite_sem_agendamento_gestao', chaveDedupe: chave, canal: 'sino',
        destinatarioTipo: 'gestao', referencia, situacao: 'registrado', modeloVersao: 0 });
    }
    avisados += 1;
  }
  return avisados;
}

/** Sessões que começam entre 2 e 30 horas a partir de agora. */
const LEMBRETE_DE_H = 2;
const LEMBRETE_ATE_H = 30;

export async function enviarLembretesDeSessao(agora: Date = new Date()): Promise<number> {
  if (!isMysqlConfigured()) return 0;
  if (!(await avisoAtivo('lembrete_sessao_paciente'))) return 0;
  // Fora do expediente o lembrete espera: ninguém recebe aviso de madrugada.
  if (proximaAberturaComercial(agora)) return 0;
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT id FROM clinica_agendamentos
      WHERE instituicao_id = ? AND status IN ('agendado', 'confirmado') AND inicio > ? AND inicio <= ?
      ORDER BY inicio LIMIT 200`,
    [instituicaoId(), new Date(agora.getTime() + LEMBRETE_DE_H * 3_600_000),
      new Date(agora.getTime() + LEMBRETE_ATE_H * 3_600_000)]
  );
  let enviados = 0;
  for (const row of rows) {
    const sessao = await getContatosDaSessao(String(row.id));
    if (!sessao?.pacienteTelefone?.trim()) continue;
    // Um lembrete por horário: remarcar gera outro, repetir a varredura não.
    const chave = `lembrete:${sessao.agendamentoId}:${sessao.inicio}`;
    if (await envioJaRegistrado(chave)) continue;
    const variaveis = variaveisDaSessao(sessao);
    const resultado = await enviarTexto(sessao.pacienteTelefone, renderizarModelo(modeloPadrao('lembrete_sessao_paciente'), variaveis),
      'lembrete_sessao_paciente', chave, false, { variaveis, referencia: `agendamento:${sessao.agendamentoId}` });
    if (resultado.situacao === 'enviada') enviados += 1;
  }
  return enviados;
}

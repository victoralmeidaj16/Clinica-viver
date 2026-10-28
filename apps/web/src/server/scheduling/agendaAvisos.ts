import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ResultSetHeader } from 'mysql2';
import { FUSO_CLINICA } from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { enviarTexto, type ResultadoEnvio } from '@/server/application/viverMaisWhatsApp';
import { appBaseUrl } from '@/server/application/appUrl';
import { comFoco, focoSessao } from '@/lib/focoNotificacao';
import { proximaAberturaComercial } from './horarioComercial';
import type { ContatosDaSessao } from './agendaRepository';
import type { DadosAvisoReenvio } from './agendaAvisosReenvio';

/**
 * Avisos de WhatsApp da agenda.
 *
 * O que a captação faz para o lead, isto faz para a sessão: quem marcou pelo
 * link recebe a confirmação do horário, e o psicólogo descobre que a agenda
 * dele mudou sem precisar abrir a plataforma. Marcar sem avisar não é meia
 * funcionalidade — é a funcionalidade contando com alguém olhando a tela.
 *
 * Duas regras herdadas do resto do sistema e uma nova:
 *
 *   1. **Nada aqui lança para quem chamou.** A sessão já está gravada quando o
 *      aviso sai; um provedor fora do ar não pode desmarcar consulta de
 *      ninguém. Falha vira log e situação registrada.
 *   2. **O telefone é validado.** Todo envio passa por `enviarTexto`, que
 *      recusa número inválido antes de qualquer chamada de rede.
 *   3. **A reserva vem antes do envio.** `clinica_agenda_avisos` tem UNIQUE por
 *      (agendamento, tipo, versão): quem insere manda, os outros desistem. É o que
 *      impede a mesma confirmação de sair duas vezes de duas instâncias.
 */

export type TipoAviso = 'confirmacao_paciente' | 'confirmacao_psicologo' | 'cancelamento_paciente' | 'remarcacao_paciente' | 'remarcacao_psicologo' | 'solicitacao_reagendamento_psicologo' | 'recusa_reagendamento_paciente';

/**
 * Reserva o aviso. `true` significa "é sua vez de enviar".
 *
 * `INSERT IGNORE` em vez de consultar-e-inserir: a leitura seguida de escrita
 * deixaria a janela entre as duas aberta, que é exatamente onde duas instâncias
 * decidiriam ambas que ninguém tinha enviado ainda.
 */
async function reservar(agendamentoId: string, tipo: TipoAviso, versao: number,
  dadosReenvio?: DadosAvisoReenvio): Promise<boolean> {
  const [resultado] = await getMysqlPool().execute<ResultSetHeader>(
    `INSERT IGNORE INTO clinica_agenda_avisos (id, instituicao_id, agendamento_id, tipo, versao, situacao, dados_reenvio)
     VALUES (?, ?, ?, ?, ?, 'reservado', ?)`,
    [randomUUID(), instituicaoId(), agendamentoId, tipo, versao, JSON.stringify(dadosReenvio ?? {})]
  );
  return resultado.affectedRows > 0;
}

/**
 * Fecha a reserva com o que aconteceu.
 *
 * Falhas ficam pendentes para a varredura. O adaptador conserva a chave de
 * entrega e evita repetir mensagens cujo resultado ainda seja desconhecido.
 */
async function encerrar(
  agendamentoId: string,
  tipo: TipoAviso,
  situacao: ResultadoEnvio['situacao'],
  versao: number,
  dadosReenvio?: DadosAvisoReenvio
): Promise<void> {
  const pool = getMysqlPool();
  if (situacao === 'falha') {
    await pool.execute(
      `UPDATE clinica_agenda_avisos SET situacao = 'aguardando_horario',
        enviar_em = CURRENT_TIMESTAMP(3), dados_reenvio = ?
        WHERE instituicao_id = ? AND agendamento_id = ? AND tipo = ? AND versao = ?`,
      [JSON.stringify(dadosReenvio ?? {}), instituicaoId(), agendamentoId, tipo, versao]
    );
    return;
  }
  await pool.execute(
    `UPDATE clinica_agenda_avisos SET situacao = ?
      WHERE instituicao_id = ? AND agendamento_id = ? AND tipo = ? AND versao = ?`,
    [situacao, instituicaoId(), agendamentoId, tipo, versao]
  );
}

export type SituacaoAviso = ResultadoEnvio['situacao'] | 'sem_telefone' | 'ja_enviado' | 'aguardando_horario' | 'erro';

/**
 * Envia sem nunca lançar.
 *
 * A promessa de que avisar não desfaz o que já foi gravado só vale se ela
 * cobrir também o banco de avisos: um erro ao reservar a linha derrubaria a
 * resposta de uma marcação bem-sucedida, e o paciente veria falha onde houve
 * sessão marcada.
 */
async function despachar(
  agendamentoId: string,
  tipo: TipoAviso,
  telefone: string | null,
  finalidade: Parameters<typeof enviarTexto>[2],
  texto: string,
  versao = 0,
  dadosReenvio?: DadosAvisoReenvio
): Promise<SituacaoAviso> {
  try {
    return await tentarDespachar(agendamentoId, tipo, telefone, finalidade, texto, versao, dadosReenvio);
  } catch (erro) {
    console.error(`[agenda] Falha ao processar aviso "${tipo}":`, erro);
    return 'erro';
  }
}

async function tentarDespachar(
  agendamentoId: string,
  tipo: TipoAviso,
  telefone: string | null,
  finalidade: Parameters<typeof enviarTexto>[2],
  texto: string,
  versao = 0,
  dadosReenvio?: DadosAvisoReenvio
): Promise<SituacaoAviso> {
  if (!telefone?.trim()) {
    console.warn(`[agenda] Aviso "${tipo}" não enviado: contato sem telefone cadastrado.`);
    return 'sem_telefone';
  }
  if (!(await reservar(agendamentoId, tipo, versao, dadosReenvio))) return 'ja_enviado';

  const resultado = await enviarTexto(telefone, texto, finalidade, `agenda:${tipo}:${agendamentoId}:${versao}`);
  await encerrar(agendamentoId, tipo, resultado.situacao, versao, dadosReenvio);
  return resultado.situacao;
}

/**
 * Deixa o aviso na fila até a abertura do expediente.
 *
 * A linha é a mesma reserva do envio imediato, só que em `aguardando_horario`:
 * a UNIQUE continua impedindo o segundo aviso, e o texto não é guardado — a
 * liberação o monta de novo com a sessão como ela estiver naquela hora.
 */
async function adiar(
  agendamentoId: string,
  tipo: TipoAviso,
  telefone: string | null,
  enviarEm: Date,
  versao = 0
): Promise<SituacaoAviso> {
  try {
    if (!telefone?.trim()) {
      console.warn(`[agenda] Aviso "${tipo}" não enviado: contato sem telefone cadastrado.`);
      return 'sem_telefone';
    }
    const [resultado] = await getMysqlPool().execute<ResultSetHeader>(
      `INSERT IGNORE INTO clinica_agenda_avisos (id, instituicao_id, agendamento_id, tipo, versao, situacao, enviar_em)
       VALUES (?, ?, ?, ?, ?, 'aguardando_horario', ?)`,
      [randomUUID(), instituicaoId(), agendamentoId, tipo, versao, enviarEm]
    );
    return resultado.affectedRows > 0 ? 'aguardando_horario' : 'ja_enviado';
  } catch (erro) {
    console.error(`[agenda] Falha ao adiar aviso "${tipo}":`, erro);
    return 'erro';
  }
}

// ---------------------------------------------------------------------------
// Textos
// ---------------------------------------------------------------------------

/** "quinta-feira, 21 de agosto, às 14:00" — como a pessoa lê, no fuso da clínica. */
export function quandoPorExtenso(iso: string): string {
  const data = new Date(iso);
  const dia = data.toLocaleDateString('pt-BR', {
    timeZone: FUSO_CLINICA,
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const hora = data.toLocaleTimeString('pt-BR', {
    timeZone: FUSO_CLINICA,
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dia}, às ${hora}`;
}

function rotuloModalidade(modalidade: ContatosDaSessao['modalidade']): string {
  switch (modalidade) {
    case 'online':
      return 'Atendimento online';
    case 'telefone':
      return 'Atendimento por telefone';
    default:
      return 'Atendimento presencial';
  }
}

/**
 * Confirmação ao paciente.
 *
 * Diz o horário, a modalidade e o que fazer para desmarcar. Não diz o que será
 * tratado nem repete dado clínico: o WhatsApp é o canal menos controlado da
 * operação, e a mensagem existe para a pessoa não faltar, não para adiantar
 * atendimento.
 */
export function textoConfirmacaoPaciente(sessao: ContatosDaSessao): string {
  return [
    `Olá, ${sessao.pacienteNome}! Sua sessão foi marcada na Viver Mais Psicologia.`,
    '',
    `Profissional: ${sessao.profissionalNome}`,
    `Quando: ${quandoPorExtenso(sessao.inicio)}`,
    rotuloModalidade(sessao.modalidade),
    '',
    'Se precisar remarcar ou desmarcar, responda esta mensagem com antecedência.',
  ].join('\n');
}

/** Aviso ao psicólogo: a agenda dele mudou e quem mudou foi o paciente. */
export function textoConfirmacaoPsicologo(sessao: ContatosDaSessao): string {
  return [
    `Olá, ${sessao.profissionalNome}! Uma sessão foi marcada na sua agenda pelo link de marcação.`,
    '',
    `Paciente: ${sessao.pacienteNome}`,
    `Quando: ${quandoPorExtenso(sessao.inicio)}`,
    rotuloModalidade(sessao.modalidade),
    '',
    'A sessão já aparece na aba Agenda da plataforma.',
  ].join('\n');
}

/**
 * Cancelamento, ao paciente.
 *
 * O motivo escrito pelo profissional fica de fora de propósito: ele é anotação
 * interna, redigida para a coordenação, e repassá-la crua transformaria um
 * campo de registro em mensagem ao paciente sem ninguém ter decidido isso.
 */
export function textoCancelamentoPaciente(sessao: ContatosDaSessao): string {
  return [
    `Olá, ${sessao.pacienteNome}. Sua sessão de ${quandoPorExtenso(sessao.inicio)} com ${sessao.profissionalNome} foi cancelada.`,
    '',
    'Entre em contato com seu(sua) psicólogo(a) para realizar um novo agendamento.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Disparos
// ---------------------------------------------------------------------------

/** Confirma ao paciente no horário comercial; fora dele, a fila aguarda a abertura. */
export async function avisarPacienteSessaoMarcada(sessao: ContatosDaSessao, agora = new Date()): Promise<void> {
  const abertura = proximaAberturaComercial(agora);
  if (abertura) {
    await adiar(sessao.agendamentoId, 'confirmacao_paciente', sessao.pacienteTelefone, abertura);
  } else {
    await despachar(
      sessao.agendamentoId,
      'confirmacao_paciente',
      sessao.pacienteTelefone,
      'agenda_confirmacao_paciente',
      textoConfirmacaoPaciente(sessao)
    );
  }
}

/** Marcação pelo link público também avisa imediatamente o profissional. */
export async function avisarSessaoMarcada(sessao: ContatosDaSessao, agora = new Date()): Promise<void> {
  await avisarPacienteSessaoMarcada(sessao, agora);
  await despachar(
    sessao.agendamentoId,
    'confirmacao_psicologo',
    sessao.profissionalTelefone,
    'agenda_confirmacao_psicologo',
    textoConfirmacaoPsicologo(sessao)
  );
}

export async function avisarSessaoCancelada(sessao: ContatosDaSessao): Promise<void> {
  await despachar(
    sessao.agendamentoId,
    'cancelamento_paciente',
    sessao.pacienteTelefone,
    'agenda_cancelamento_paciente',
    textoCancelamentoPaciente(sessao)
  );
}

/** Cada versão da sessão pode avisar os dois destinatários uma vez. */
export async function avisarSessaoRemarcada(sessao: ContatosDaSessao, inicioAnterior: string, versao: number): Promise<void> {
  const textos = textosRemarcacao(sessao, inicioAnterior);
  const dados = { inicioAnterior, inicioNovo: sessao.inicio, fimNovo: sessao.fim, modalidade: sessao.modalidade };
  await despachar(sessao.agendamentoId, 'remarcacao_paciente', sessao.pacienteTelefone,
    'agenda_remarcacao_paciente', textos.paciente, versao, dados);
  await despachar(sessao.agendamentoId, 'remarcacao_psicologo', sessao.profissionalTelefone,
    'agenda_remarcacao_psicologo', textos.profissional, versao, dados);
}

export function textosRemarcacao(sessao: ContatosDaSessao, inicioAnterior: string) {
  const detalhes = [
    `Horário anterior: ${quandoPorExtenso(inicioAnterior)}`,
    `Novo horário: ${quandoPorExtenso(sessao.inicio)}`,
    rotuloModalidade(sessao.modalidade),
  ].join('\n');
  return {
    paciente: `Olá, ${sessao.pacienteNome}! Sua sessão com ${sessao.profissionalNome} foi remarcada.\n\n${detalhes}`,
    profissional: `Olá, ${sessao.profissionalNome}! A sessão de ${sessao.pacienteNome} foi remarcada.\n\n${detalhes}`,
  };
}

export function textoSolicitacaoReagendamentoPsicologo(
  sessao: ContatosDaSessao,
  inicioSolicitado: string
): string {
  const link = `${appBaseUrl()}${comFoco('/agenda', focoSessao(sessao.agendamentoId))}`;
  return [
    `Olá, ${sessao.profissionalNome}! ${sessao.pacienteNome} solicitou um reagendamento.`,
    '',
    `Horário atual: ${quandoPorExtenso(sessao.inicio)}`,
    `Horário solicitado: ${quandoPorExtenso(inicioSolicitado)}`,
    '',
    `Acesse a plataforma para aceitar ou recusar: ${link}`,
  ].join('\n');
}

export async function avisarSolicitacaoReagendamentoPsicologo(
  sessao: ContatosDaSessao,
  inicioSolicitado: string,
  sequencia: number
): Promise<void> {
  await despachar(
    sessao.agendamentoId,
    'solicitacao_reagendamento_psicologo',
    sessao.profissionalTelefone,
    'agenda_solicitacao_reagendamento_psicologo',
    textoSolicitacaoReagendamentoPsicologo(sessao, inicioSolicitado),
    sequencia,
    { inicioSolicitado }
  );
}

export async function avisarRecusaReagendamentoPaciente(
  sessao: ContatosDaSessao,
  sequencia: number
): Promise<void> {
  await despachar(
    sessao.agendamentoId,
    'recusa_reagendamento_paciente',
    sessao.pacienteTelefone,
    'agenda_recusa_reagendamento_paciente',
    textoRecusaReagendamentoPaciente(sessao),
    sequencia
  );
}

export function textoRecusaReagendamentoPaciente(sessao: ContatosDaSessao): string {
  return `Olá, ${sessao.pacienteNome}. A solicitação de mudança não foi aceita. Sua sessão continua confirmada para ${quandoPorExtenso(sessao.inicio)}.`;
}

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
import { finalizarAviso } from './finalizarAviso';
import type { DadosAvisoReenvio } from './agendaAvisosReenvio';
import { modeloPadrao } from '@/lib/avisos/catalogo';
import { renderizarModelo, type ValoresDoModelo } from '@/lib/avisos/modelo';

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
 * Devolve o ID da reserva adquirida por esta chamada.
 *
 * `INSERT IGNORE` em vez de consultar-e-inserir: a leitura seguida de escrita
 * deixaria a janela entre as duas aberta, que é exatamente onde duas instâncias
 * decidiriam ambas que ninguém tinha enviado ainda.
 */
async function reservar(agendamentoId: string, tipo: TipoAviso, versao: number,
  dadosReenvio?: DadosAvisoReenvio): Promise<string | null> {
  const id = randomUUID();
  const [resultado] = await getMysqlPool().execute<ResultSetHeader>(
    `INSERT IGNORE INTO clinica_agenda_avisos (id, instituicao_id, agendamento_id, tipo, versao, situacao, dados_reenvio)
     VALUES (?, ?, ?, ?, ?, 'reservado', ?)`,
    [id, instituicaoId(), agendamentoId, tipo, versao, JSON.stringify(dadosReenvio ?? {})]
  );
  return resultado.affectedRows > 0 ? id : null;
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
  dadosReenvio?: DadosAvisoReenvio,
  variaveis?: ValoresDoModelo
): Promise<SituacaoAviso> {
  try {
    return await tentarDespachar(agendamentoId, tipo, telefone, finalidade, texto, versao, dadosReenvio, variaveis);
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
  dadosReenvio?: DadosAvisoReenvio,
  variaveis?: ValoresDoModelo
): Promise<SituacaoAviso> {
  if (!telefone?.trim()) {
    console.warn(`[agenda] Aviso "${tipo}" não enviado: contato sem telefone cadastrado.`);
    return 'sem_telefone';
  }
  const id = await reservar(agendamentoId, tipo, versao, dadosReenvio);
  if (!id) return 'ja_enviado';

  const resultado = await enviarTexto(telefone, texto, finalidade, `agenda:${tipo}:${agendamentoId}:${versao}`,
    false, { variaveis, referencia: `agendamento:${agendamentoId}` });
  await finalizarAviso(id, resultado);
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

export function rotuloModalidade(modalidade: ContatosDaSessao['modalidade']): string {
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
/** Campos comuns aos avisos da agenda (12.02). */
export function variaveisDaSessao(sessao: ContatosDaSessao, extras: ValoresDoModelo = {}): ValoresDoModelo {
  return {
    nome_paciente: sessao.pacienteNome,
    nome_profissional: sessao.profissionalNome,
    dia_horario: quandoPorExtenso(sessao.inicio),
    modalidade: rotuloModalidade(sessao.modalidade),
    ...extras,
  };
}

export function textoConfirmacaoPaciente(sessao: ContatosDaSessao): string {
  return renderizarModelo(modeloPadrao('agenda_confirmacao_paciente'), variaveisDaSessao(sessao));
}

/** Aviso ao psicólogo: a agenda dele mudou e quem mudou foi o paciente. */
export function textoConfirmacaoPsicologo(sessao: ContatosDaSessao): string {
  return renderizarModelo(modeloPadrao('agenda_confirmacao_psicologo'), variaveisDaSessao(sessao));
}

/**
 * Cancelamento, ao paciente.
 *
 * O motivo escrito pelo profissional fica de fora de propósito: ele é anotação
 * interna, redigida para a coordenação, e repassá-la crua transformaria um
 * campo de registro em mensagem ao paciente sem ninguém ter decidido isso.
 */
export function textoCancelamentoPaciente(sessao: ContatosDaSessao): string {
  return renderizarModelo(modeloPadrao('agenda_cancelamento_paciente'), variaveisDaSessao(sessao));
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
      textoConfirmacaoPaciente(sessao),
      0,
      undefined,
      variaveisDaSessao(sessao)
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
    textoConfirmacaoPsicologo(sessao),
    0,
    undefined,
    variaveisDaSessao(sessao)
  );
}

export async function avisarSessaoCancelada(sessao: ContatosDaSessao): Promise<void> {
  await despachar(
    sessao.agendamentoId,
    'cancelamento_paciente',
    sessao.pacienteTelefone,
    'agenda_cancelamento_paciente',
    textoCancelamentoPaciente(sessao),
    0,
    undefined,
    variaveisDaSessao(sessao)
  );
}

/** Cada versão da sessão pode avisar os dois destinatários uma vez. */
export async function avisarSessaoRemarcada(sessao: ContatosDaSessao, inicioAnterior: string, versao: number): Promise<void> {
  const textos = textosRemarcacao(sessao, inicioAnterior);
  const dados = { inicioAnterior, inicioNovo: sessao.inicio, fimNovo: sessao.fim, modalidade: sessao.modalidade };
  const variaveis = variaveisRemarcacao(sessao, inicioAnterior);
  await despachar(sessao.agendamentoId, 'remarcacao_paciente', sessao.pacienteTelefone,
    'agenda_remarcacao_paciente', textos.paciente, versao, dados, variaveis);
  await despachar(sessao.agendamentoId, 'remarcacao_psicologo', sessao.profissionalTelefone,
    'agenda_remarcacao_psicologo', textos.profissional, versao, dados, variaveis);
}

export function variaveisRemarcacao(sessao: ContatosDaSessao, inicioAnterior: string): ValoresDoModelo {
  return variaveisDaSessao(sessao, {
    horario_anterior: quandoPorExtenso(inicioAnterior),
    novo_horario: quandoPorExtenso(sessao.inicio),
  });
}

export function textosRemarcacao(sessao: ContatosDaSessao, inicioAnterior: string) {
  const variaveis = variaveisRemarcacao(sessao, inicioAnterior);
  return {
    paciente: renderizarModelo(modeloPadrao('agenda_remarcacao_paciente'), variaveis),
    profissional: renderizarModelo(modeloPadrao('agenda_remarcacao_psicologo'), variaveis),
  };
}

export function variaveisSolicitacaoReagendamento(sessao: ContatosDaSessao, inicioSolicitado: string): ValoresDoModelo {
  return variaveisDaSessao(sessao, {
    horario_solicitado: quandoPorExtenso(inicioSolicitado),
    link_agenda: `${appBaseUrl()}${comFoco('/agenda', focoSessao(sessao.agendamentoId))}`,
  });
}

export function textoSolicitacaoReagendamentoPsicologo(
  sessao: ContatosDaSessao,
  inicioSolicitado: string
): string {
  return renderizarModelo(modeloPadrao('agenda_solicitacao_reagendamento_psicologo'),
    variaveisSolicitacaoReagendamento(sessao, inicioSolicitado));
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
    { inicioSolicitado },
    variaveisSolicitacaoReagendamento(sessao, inicioSolicitado)
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
    sequencia,
    undefined,
    variaveisDaSessao(sessao)
  );
}

export function textoRecusaReagendamentoPaciente(sessao: ContatosDaSessao): string {
  return renderizarModelo(modeloPadrao('agenda_recusa_reagendamento_paciente'), variaveisDaSessao(sessao));
}

import 'server-only';

import { randomUUID } from 'node:crypto';
import type { ResultSetHeader } from 'mysql2';
import { FUSO_CLINICA } from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { enviarTexto, type ResultadoEnvio } from '@/server/application/viverMaisWhatsApp';
import type { ContatosDaSessao } from './agendaRepository';

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
 *   2. **A allowlist do piloto vale.** Todo envio passa por `enviarTexto`, que
 *      consulta a trava antes de qualquer chamada de rede.
 *   3. **A reserva vem antes do envio.** `clinica_agenda_avisos` tem UNIQUE por
 *      (agendamento, tipo): quem insere manda, os outros desistem. É o que
 *      impede a mesma confirmação de sair duas vezes de duas instâncias.
 */

export type TipoAviso = 'confirmacao_paciente' | 'confirmacao_psicologo' | 'cancelamento_paciente';

/**
 * Reserva o aviso. `true` significa "é sua vez de enviar".
 *
 * `INSERT IGNORE` em vez de consultar-e-inserir: a leitura seguida de escrita
 * deixaria a janela entre as duas aberta, que é exatamente onde duas instâncias
 * decidiriam ambas que ninguém tinha enviado ainda.
 */
async function reservar(agendamentoId: string, tipo: TipoAviso): Promise<boolean> {
  const [resultado] = await getMysqlPool().execute<ResultSetHeader>(
    `INSERT IGNORE INTO clinica_agenda_avisos (id, instituicao_id, agendamento_id, tipo, situacao)
     VALUES (?, ?, ?, ?, 'reservado')`,
    [randomUUID(), instituicaoId(), agendamentoId, tipo]
  );
  return resultado.affectedRows > 0;
}

/**
 * Fecha a reserva com o que aconteceu.
 *
 * Falha de rede **apaga** a reserva: o lembrete que não saiu por instabilidade
 * precisa da próxima varredura, e uma linha permanente diria à varredura que
 * ele já foi. Bloqueio de allowlist e provedor ausente ficam gravados porque
 * tentar de novo daria no mesmo — e a linha vira o registro de que a mensagem
 * não saiu, em vez de silêncio.
 */
async function encerrar(
  agendamentoId: string,
  tipo: TipoAviso,
  situacao: ResultadoEnvio['situacao']
): Promise<void> {
  const pool = getMysqlPool();
  if (situacao === 'falha') {
    await pool.execute(
      'DELETE FROM clinica_agenda_avisos WHERE instituicao_id = ? AND agendamento_id = ? AND tipo = ?',
      [instituicaoId(), agendamentoId, tipo]
    );
    return;
  }
  await pool.execute(
    `UPDATE clinica_agenda_avisos SET situacao = ?
      WHERE instituicao_id = ? AND agendamento_id = ? AND tipo = ?`,
    [situacao, instituicaoId(), agendamentoId, tipo]
  );
}

export type SituacaoAviso = ResultadoEnvio['situacao'] | 'sem_telefone' | 'ja_enviado' | 'erro';

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
  texto: string
): Promise<SituacaoAviso> {
  try {
    return await tentarDespachar(agendamentoId, tipo, telefone, finalidade, texto);
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
  texto: string
): Promise<SituacaoAviso> {
  if (!telefone?.trim()) {
    console.warn(`[agenda] Aviso "${tipo}" não enviado: contato sem telefone cadastrado.`);
    return 'sem_telefone';
  }
  if (!(await reservar(agendamentoId, tipo))) return 'ja_enviado';

  const resultado = await enviarTexto(telefone, texto, finalidade, `agenda:${tipo}:${agendamentoId}`);
  await encerrar(agendamentoId, tipo, resultado.situacao);
  return resultado.situacao;
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
    'Você pode escolher um novo horário pelo link de marcação que recebeu.',
    'Em caso de dúvida, responda esta mensagem.',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Disparos
// ---------------------------------------------------------------------------

/** Disparo duplo da marcação: confirma ao paciente e avisa o profissional. */
export async function avisarSessaoMarcada(sessao: ContatosDaSessao): Promise<void> {
  await despachar(
    sessao.agendamentoId,
    'confirmacao_paciente',
    sessao.pacienteTelefone,
    'agenda_confirmacao_paciente',
    textoConfirmacaoPaciente(sessao)
  );
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

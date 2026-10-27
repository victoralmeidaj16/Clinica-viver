import 'server-only';

import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { enviarTexto } from '@/server/application/viverMaisWhatsApp';
import { getContatosDaSessao } from './agendaRepository';
import { avisoParaReenvio } from './agendaAvisosReenvio';
import { proximaAberturaComercial } from './horarioComercial';

/**
 * Libera avisos adiados ou que precisam de nova tentativa.
 *
 * Chamado pelo mesmo worker da varredura de SLA, a cada poucos minutos. Cada
 * linha é tomada por um UPDATE condicional antes do envio. Avisos de sessões
 * alteradas ou pedidos já respondidos são descartados quando deixam de valer.
 */

const SESSAO_ATIVA = new Set(['agendado', 'confirmado']);

export interface ResultadoLiberacao {
  enviados: number;
  descartados: number;
  adiados: number;
}

async function marcar(id: string, situacao: string, de: string): Promise<boolean> {
  const [resultado] = await getMysqlPool().execute<ResultSetHeader>(
    'UPDATE clinica_agenda_avisos SET situacao = ? WHERE instituicao_id = ? AND id = ? AND situacao = ?',
    [situacao, instituicaoId(), id, de]
  );
  return resultado.affectedRows > 0;
}

export async function liberarAvisosAguardando(agora = new Date()): Promise<ResultadoLiberacao> {
  const resultado: ResultadoLiberacao = { enviados: 0, descartados: 0, adiados: 0 };
  if (proximaAberturaComercial(agora)) return resultado;

  // Recupera processos interrompidos; o adaptador mantém a chave de envio
  // durável e não repete uma entrega cujo resultado seja desconhecido.
  await getMysqlPool().execute(
    `UPDATE clinica_agenda_avisos SET situacao = 'aguardando_horario', enviar_em = ?
      WHERE instituicao_id = ? AND situacao = 'reservado' AND atualizado_em < ?`,
    [agora, instituicaoId(), new Date(agora.getTime() - 10 * 60_000)]
  );

  const [linhas] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT id, agendamento_id, tipo, versao, dados_reenvio FROM clinica_agenda_avisos
      WHERE instituicao_id = ? AND situacao = 'aguardando_horario'
        AND enviar_em <= ?
      ORDER BY enviar_em LIMIT 50`,
    [instituicaoId(), agora]
  );

  for (const linha of linhas) {
    const id = String(linha.id);
    if (!(await marcar(id, 'reservado', 'aguardando_horario'))) continue;
    try {
      const sessao = await getContatosDaSessao(String(linha.agendamento_id));
      const tipo = String(linha.tipo ?? 'confirmacao_paciente');
      const versao = Number(linha.versao ?? 0);
      const dados = typeof linha.dados_reenvio === 'string' ? JSON.parse(linha.dados_reenvio) : linha.dados_reenvio ?? {};
      let solicitacaoValida = true;
      if (tipo === 'solicitacao_reagendamento_psicologo' || tipo === 'recusa_reagendamento_paciente') {
        const [pedidos] = await getMysqlPool().query<RowDataPacket[]>(
          'SELECT status, inicio_atual, fim_atual FROM clinica_solicitacoes_reagendamento WHERE instituicao_id = ? AND agendamento_id = ? AND numero = ?',
          [instituicaoId(), linha.agendamento_id, versao]
        );
        solicitacaoValida = pedidos[0]?.status === (tipo === 'solicitacao_reagendamento_psicologo' ? 'pendente' : 'recusada');
        if (solicitacaoValida && tipo === 'solicitacao_reagendamento_psicologo' && sessao) {
          solicitacaoValida = new Date(pedidos[0].inicio_atual).getTime() === Date.parse(sessao.inicio)
            && new Date(pedidos[0].fim_atual).getTime() === Date.parse(sessao.fim);
        }
      }
      const mensagem = sessao ? avisoParaReenvio(tipo, sessao, dados) : null;
      if (
        !sessao || !mensagem?.telefone?.trim() || !solicitacaoValida ||
        (tipo === 'cancelamento_paciente' ? sessao.status !== 'cancelado'
          : !SESSAO_ATIVA.has(sessao.status) || Date.parse(sessao.inicio) <= agora.getTime()) ||
        (tipo.startsWith('remarcacao_') && (Date.parse(dados.inicioNovo ?? '') !== Date.parse(sessao.inicio)
          || Date.parse(dados.fimNovo ?? '') !== Date.parse(sessao.fim) || dados.modalidade !== sessao.modalidade))
      ) {
        await marcar(id, 'descartada', 'reservado');
        resultado.descartados += 1;
        continue;
      }
      const envio = await enviarTexto(
        mensagem.telefone,
        mensagem.texto,
        mensagem.finalidade,
        `agenda:${tipo}:${sessao.agendamentoId}:${versao}`
      );
      // Falha de rede volta para a fila: a próxima varredura tenta de novo,
      // até a sessão começar e a linha ser descartada.
      if (envio.situacao === 'falha') {
        await marcar(id, 'aguardando_horario', 'reservado');
        resultado.adiados += 1;
      } else {
        await marcar(id, envio.situacao, 'reservado');
        if (envio.situacao === 'enviada') resultado.enviados += 1;
      }
    } catch (erro) {
      console.error('[agenda] Falha ao liberar aviso adiado:', erro);
      await marcar(id, 'aguardando_horario', 'reservado').catch(() => undefined);
      resultado.adiados += 1;
    }
  }
  return resultado;
}

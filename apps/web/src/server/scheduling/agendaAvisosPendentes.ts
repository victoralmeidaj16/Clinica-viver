import 'server-only';

import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { enviarTexto } from '@/server/application/viverMaisWhatsApp';
import { getContatosDaSessao } from './agendaRepository';
import { textoConfirmacaoPaciente } from './agendaAvisos';
import { proximaAberturaComercial } from './horarioComercial';

/**
 * Libera os avisos que esperavam o horário comercial.
 *
 * Chamado pelo mesmo worker da varredura de SLA, a cada poucos minutos. Cada
 * linha é tomada por um UPDATE condicional antes do envio — duas chamadas
 * simultâneas não mandam a mesma mensagem. O texto é montado com a sessão como
 * ela está agora: remarcada, sai com o horário novo; cancelada ou já passada,
 * a linha é descartada sem envio.
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

  const [linhas] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT id, agendamento_id, versao FROM clinica_agenda_avisos
      WHERE instituicao_id = ? AND situacao = 'aguardando_horario' AND tipo = 'confirmacao_paciente'
        AND enviar_em <= ?
      ORDER BY enviar_em LIMIT 50`,
    [instituicaoId(), agora]
  );

  for (const linha of linhas) {
    const id = String(linha.id);
    if (!(await marcar(id, 'reservado', 'aguardando_horario'))) continue;
    try {
      const sessao = await getContatosDaSessao(String(linha.agendamento_id));
      if (
        !sessao?.pacienteTelefone?.trim() ||
        !SESSAO_ATIVA.has(sessao.status) ||
        Date.parse(sessao.inicio) <= agora.getTime()
      ) {
        await marcar(id, 'descartada', 'reservado');
        resultado.descartados += 1;
        continue;
      }
      const envio = await enviarTexto(
        sessao.pacienteTelefone,
        textoConfirmacaoPaciente(sessao),
        'agenda_confirmacao_paciente',
        `agenda:confirmacao_paciente:${sessao.agendamentoId}:${Number(linha.versao ?? 0)}`
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

import 'server-only';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';
import { confirmarPrazoInterPix, getInterPixCharge } from '@/server/adapters/interPixAdapter';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import { diferencasDoAgendamento } from '@/lib/alteracoesAgendamento';
import { registrarAlteracaoAgendamento } from '@/server/persistence/mysql/agendamentoAlteracoesRepository';
import { saldoAbertoSql } from './chargeDueBalance';
import { reconcileSettledInterPixCharge } from './paymentLinkRepository';
import type { DueResetPlan } from './sessionChargeDuePlan';

export async function aplicarVencimentoSolicitado(connection: PoolConnection, job: RowDataPacket, plan: DueResetPlan) {
  const charge = plan.charges[0];
  const params = [instituicaoId(), charge.organizacao_ref, charge.ref_core];
  const ler = async (travar: boolean) => {
    const [[row]] = await connection.query<RowDataPacket[]>(`SELECT c.ref_core, c.status, ${saldoAbertoSql} AS saldo_centavos
      FROM financeiro_cobrancas c WHERE c.instituicao_id=? AND c.organizacao_ref=? AND c.ref_core=? ${travar ? 'FOR UPDATE' : ''}`, params);
    return row;
  };
  const saldo = (row?: RowDataPacket) => row && ['pending','partially_paid','overdue','draft'].includes(row.status)
    ? Number(row.saldo_centavos) : 0;
  const antes = saldo(await ler(false));
  const remote = plan.remotes[0];
  const dueAt = fromSqlTimestamp(job.vence_em)!;
  let outcome: 'paid' | 'updated' | 'rejected' = 'paid';
  if (antes > 0) {
    outcome = remote ? await confirmarPrazoInterPix(remote.id, dueAt, antes) : 'updated';
    if (remote && outcome === 'paid') await reconcileSettledInterPixCharge(await getInterPixCharge(remote.id));
  }
  await connection.beginTransaction();
  try {
    const atual = saldo(await ler(true));
    if (!atual) outcome = 'paid';
    else if (atual !== antes) { await connection.rollback(); return 'queued' as const; }
    if (outcome === 'updated') {
      await connection.execute(`UPDATE financeiro_cobrancas SET vence_em = ?, status=IF(status='overdue','pending',status)
        WHERE instituicao_id=? AND organizacao_ref=? AND ref_core=?`, [job.vence_em, ...params]);
      await connection.execute('UPDATE clinica_agendamentos SET cobranca_vence_em = ? WHERE instituicao_id = ? AND id = ?',
        [job.vence_em, instituicaoId(), job.agendamento_id]);
      if (plan.historico) {
        const h = plan.historico;
        const mudancas = diferencasDoAgendamento({ venceEm:h.anterior },{ venceEm:dueAt });
        if (mudancas.length) await registrarAlteracaoAgendamento(connection,{ organizacaoRef:charge.organizacao_ref,
          profissionalRef:h.profissional, usuarioRef:h.usuarioRef, nome:h.nome, agendamentoId:job.agendamento_id, alteradoEm:new Date(),mudancas });
      }
    }
    await connection.execute(`UPDATE financeiro_ajustes_vencimento SET situacao = ?, plano=JSON_SET(plano,
      '$.resultado', ?, '$.saldoCentavos', ?, '$.instrucao', ?) WHERE instituicao_id=? AND id=?`,
    [outcome === 'updated' ? 'completed' : outcome, outcome, antes, remote?.id ?? null, instituicaoId(), job.id]);
    await connection.commit();
    return outcome;
  } catch (error) { await connection.rollback(); throw error; }
}

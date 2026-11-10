import 'server-only';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { custeioDoAgendamentoSql } from '@/server/persistence/mysql/custeioSql';
import { isFutureChargeDueAt } from '@/lib/chargeDue';
import { enqueueChargeDuePlan, resetAppointmentChargeDue, type UpdateChargeDueOutcome } from './sessionChargeDue';
import { readChargeResetPlan } from './sessionChargeDuePlan';
import { processAppointmentChargeDue } from './sessionChargeDueWorker';

export type ChargeDueByChargeOutcome = UpdateChargeDueOutcome | 'covered';

/**
 * Altera o vencimento a partir da cobrança, como a gestão a enxerga no financeiro.
 * A organização vem da sessão autenticada e delimita todas as consultas.
 */
export async function atualizarVencimentoPorCobranca(input: {
  organizationId: string; chargeId: string; dueAt: string;
}): Promise<ChargeDueByChargeOutcome> {
  if (!isFutureChargeDueAt(input.dueAt)) return 'invalid';
  const connection = await getMysqlPool().getConnection();
  let jobKey: string;
  let result: UpdateChargeDueOutcome;
  try {
    await connection.beginTransaction();
    // A mesma ordem de travas da remarcação: agenda, cobrança, checkout e fila.
    const [appointments] = await connection.query<RowDataPacket[]>(
      `SELECT a.id FROM clinica_agendamentos a
         JOIN clinica_organizacoes o ON o.id = a.organizacao_id
         JOIN financeiro_cobrancas c ON c.instituicao_id = a.instituicao_id AND c.organizacao_ref = o.ref_core
          AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND c.ref_core = ? LIMIT 1`,
      [instituicaoId(), input.organizationId, input.chargeId]
    );
    const appointmentId = appointments[0] ? String(appointments[0].id) : undefined;
    if (appointmentId) {
      await connection.query(
        'SELECT id FROM clinica_agendamentos WHERE instituicao_id = ? AND id = ? FOR UPDATE',
        [instituicaoId(), appointmentId]
      );
    }
    const [charges] = await connection.query<RowDataPacket[]>(
      `SELECT c.id, c.ref_core, c.status, c.provedor_ref, c.organizacao_ref,
              EXISTS(SELECT 1 FROM financeiro_pagamentos p
                WHERE p.instituicao_id = c.instituicao_id AND p.organizacao_ref = c.organizacao_ref
                  AND p.cobranca_ref = c.ref_core AND p.status = 'confirmed') AS possui_pagamento
         FROM financeiro_cobrancas c
        WHERE c.instituicao_id = ? AND c.organizacao_ref = ? AND c.ref_core = ?
          AND c.status <> 'cancelled' FOR UPDATE`,
      [instituicaoId(), input.organizationId, input.chargeId]
    );
    if (!charges.length) { await connection.rollback(); return 'not_found'; }
    // Sessão custeada ou já faturada ao convênio não tem prazo do paciente a alterar.
    const [coverage] = await connection.query<RowDataPacket[]>(
      `SELECT fc.fatura_convenio_ref,
              ${custeioDoAgendamentoSql({ agendamento: 'ag', paciente: 'p', convenio: 'conv' })} AS custeado
         FROM financeiro_cobrancas fc
         JOIN clinica_pacientes p ON p.instituicao_id = fc.instituicao_id AND p.ref_core = fc.paciente_ref
         LEFT JOIN clinica_agendamentos ag ON ag.instituicao_id = fc.instituicao_id
          AND fc.sessao_ref IN (ag.ref_core, ag.sessao_clinica_ref)
         LEFT JOIN clinica_convenios conv ON conv.instituicao_id = fc.instituicao_id
          AND conv.organizacao_ref = fc.organizacao_ref AND conv.ref_core = COALESCE(fc.convenio_ref, p.convenio_ref)
        WHERE fc.instituicao_id = ? AND fc.organizacao_ref = ? AND fc.ref_core = ?`,
      [instituicaoId(), input.organizationId, input.chargeId]
    );
    if (coverage.some((row) => row.custeado || row.fatura_convenio_ref)) { await connection.rollback(); return 'covered'; }
    if (appointmentId) {
      jobKey = appointmentId;
      result = await resetAppointmentChargeDue(connection, appointmentId, input.dueAt);
    } else {
      const plan = await readChargeResetPlan(connection, charges);
      if (!plan) { await connection.rollback(); return 'not_found'; }
      if (plan.paid) { await connection.rollback(); return 'paid'; }
      // Cobranças legadas sem agenda usam sua própria chave física para a retomada.
      jobKey = String(charges[0].id);
      await enqueueChargeDuePlan(connection, jobKey, input.dueAt, plan);
      result = 'queued';
    }
    if (result === 'paid') { await connection.rollback(); return 'paid'; }
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
  return result === 'queued' ? processAppointmentChargeDue(jobKey) : result;
}

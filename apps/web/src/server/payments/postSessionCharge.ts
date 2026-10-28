import 'server-only';
import type { AppointmentRepository, FinancialCharge, FinancialRepository } from '@thats-life/core';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import { MysqlFinancialRepository } from '@/server/persistence/mysql/financialRepository';

type Dependencies = { financial: FinancialRepository; appointments: AppointmentRepository };
let demoQueue: Promise<unknown> = Promise.resolve();

function existingCharge(charges: FinancialCharge[], requested: FinancialCharge): FinancialCharge | undefined {
  if (charges.length > 1) throw new Error('Há mais de uma cobrança para este atendimento. A gestão precisa conferir o financeiro.');
  const charge = charges[0];
  if (charge && (charge.organizationId !== requested.organizationId || charge.patientId !== requested.patientId
    || charge.professionalId !== requested.professionalId)) throw new Error('A cobrança não corresponde aos vínculos da sessão.');
  return charge;
}

/** A referência física da cobrança continua intacta; o comando clínico recebe a sessão equivalente. */
export async function garantirCobrancaPosSessao(requested: FinancialCharge, dependencies: Dependencies): Promise<FinancialCharge> {
  if (!isMysqlConfigured()) {
    const run = demoQueue.then(async () => {
      const appointments = await dependencies.appointments.list({ organizationId: requested.organizationId });
      const refs = new Set([requested.sessionId, ...appointments
        .filter((a) => a.clinicalSessionId === requested.sessionId).map((a) => a.id)]);
      const ledger = await dependencies.financial.getLedger({ organizationId: requested.organizationId });
      const existing = existingCharge(ledger.charges.filter((c) => refs.has(c.sessionId)
        && (c.status !== 'cancelled' || c.id === requested.id)), requested);
      if (existing) return { ...existing, sessionId: requested.sessionId };
      await dependencies.financial.saveCharge(requested);
      return requested;
    });
    demoQueue = run.catch(() => undefined);
    return run;
  }

  const connection = await getMysqlPool().getConnection();
  try {
    await connection.beginTransaction();
    // Mesma ordem do checkout público: agenda antes de sessão/cobrança.
    const [appointments] = await connection.query<RowDataPacket[]>(
      `SELECT a.ref_core FROM clinica_agendamentos a JOIN clinica_organizacoes o ON o.id = a.organizacao_id
        WHERE a.instituicao_id = ? AND o.ref_core = ? AND (a.sessao_clinica_ref = ? OR a.ref_core = ?)
        FOR UPDATE`,
      [instituicaoId(), requested.organizationId, requested.sessionId, requested.sessionId],
    );
    const [sessions] = await connection.query<RowDataPacket[]>(
      `SELECT ref_core FROM clinica_sessoes WHERE instituicao_id = ? AND organizacao_ref = ? AND ref_core = ? FOR UPDATE`,
      [instituicaoId(), requested.organizationId, requested.sessionId],
    );
    if (!sessions.length) throw new Error('Sessão clínica não encontrada.');
    const refs = [...new Set([requested.sessionId, ...appointments.map((a) => String(a.ref_core))])];
    const [rows] = await connection.query<RowDataPacket[]>(
      `SELECT ref_core FROM financeiro_cobrancas WHERE instituicao_id = ? AND organizacao_ref = ?
        AND sessao_ref IN (?) AND (status <> 'cancelled' OR ref_core = ?) FOR UPDATE`,
      [instituicaoId(), requested.organizationId, refs, requested.id],
    );
    const repository = new MysqlFinancialRepository(connection);
    const charges = await Promise.all(rows.map((row) => repository.getChargeById(String(row.ref_core))));
    if (charges.some((charge) => !charge)) throw new Error('Cobrança não encontrada.');
    const existing = existingCharge(charges as FinancialCharge[], requested);
    if (!existing) await repository.saveCharge(requested);
    await connection.commit();
    return { ...(existing ?? requested), sessionId: requested.sessionId };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally { connection.release(); }
}

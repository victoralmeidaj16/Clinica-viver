import {
  assertStaffAuthorized,
  exportFinancialReportCsv,
  generateFinancialReports,
  reconcileSessionReceivables,
  type ChargeStatus,
  type FinancialFilter,
} from '@thats-life/core';
import type { RowDataPacket } from 'mysql2';
import type { RequestContext } from './context';
import { getApplicationStore } from './store';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export async function getFinancialReportsData(
  context: RequestContext,
  filter: FinancialFilter = {}
) {
  const store = getApplicationStore();
  const { organizationId } = context.actor;

  assertStaffAuthorized(context.actor, 'billing.read', { organizationId });

  const ledger = await store.financial.getLedger({ organizationId, ...filter });
  const reportBundle = generateFinancialReports(
    ledger,
    {
      organizationId,
      startDate: filter.startDate,
      endDate: filter.endDate,
    },
    new Date().toISOString()
  );

  return reportBundle;
}

export async function getMyFinancialData(
  context: RequestContext,
  filter: FinancialFilter = {}
) {
  const professionalId = context.actor.professionalProfileId;
  if (!professionalId) {
    throw new Error('Perfil profissional não encontrado para este acesso.');
  }
  const store = getApplicationStore();
  const organizationId = context.actor.organizationId;
  // `billing.read` abre o razão inteiro e não pertence ao papel profissional.
  // Aqui o recorte pelo perfil é obrigatório antes da leitura.
  assertStaffAuthorized(context.actor, 'organization.read', { organizationId });
  const ledger = await store.financial.getLedger({
    organizationId,
    professionalIds: [professionalId],
  });
  const patients = await store.identities.listPatients(organizationId);
  const names = new Map(patients.map((patient) => [patient.id, patient.displayName]));
  const charges = new Map(ledger.charges.map((charge) => [charge.id, charge]));
  const transactions = ledger.payments
    .filter((payment) => payment.status === 'confirmed')
    .filter((payment) => !filter.startDate || Date.parse(payment.receivedAt) >= Date.parse(filter.startDate))
    .filter((payment) => !filter.endDate || Date.parse(payment.receivedAt) <= Date.parse(filter.endDate))
    .map((payment) => {
      const charge = charges.get(payment.chargeId);
      return {
        id: payment.id,
        patientName: charge ? names.get(charge.patientId) ?? 'Paciente' : 'Paciente',
        receivedAt: payment.receivedAt,
        amountCents: payment.amountCents,
        professionalCreditCents: Math.round(payment.amountCents * 0.7),
        clinicRevenueCents: payment.amountCents - Math.round(payment.amountCents * 0.7),
        method: payment.method,
      };
    })
    .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt));

  // Mapeamento dos agendamentos para obter o status de atendimento (agendado vs realizado)
  const appointmentsMap = new Map<string, {
    appointmentId: string;
    attendanceStatus: 'agendado' | 'realizado' | 'cancelado';
    startsAt: string;
    endsAt: string;
    modalidade: 'online' | 'presencial' | 'telefone';
  }>();

  try {
    const appointments = await store.appointments.list({ organizationId, professionalId });
    for (const apt of appointments) {
      const statusNorm: 'agendado' | 'realizado' | 'cancelado' =
        apt.status === 'completed' ? 'realizado' :
        apt.status === 'cancelled' ? 'cancelado' : 'agendado';
      const entry = {
        appointmentId: apt.id,
        attendanceStatus: statusNorm,
        startsAt: apt.startsAt,
        endsAt: apt.endsAt,
        modalidade: (apt.mode === 'in_person' ? 'presencial' : apt.mode === 'phone' ? 'telefone' : 'online') as 'online' | 'presencial' | 'telefone',
      };
      appointmentsMap.set(apt.id, entry);
      if (apt.clinicalSessionId) {
        appointmentsMap.set(apt.clinicalSessionId, entry);
      }
    }
  } catch (err) {
    console.error('[financial] Falha ao ler agendamentos do store:', err);
  }

  if (isMysqlConfigured()) {
    try {
      const [rows] = await getMysqlPool().query<RowDataPacket[]>(
        `SELECT a.id, a.ref_core, a.sessao_clinica_ref, a.status, a.inicio, a.fim, a.duracao_min, a.modalidade
           FROM clinica_agendamentos a
           JOIN clinica_profissionais p ON p.id = a.profissional_id
           JOIN clinica_organizacoes o ON o.id = p.organizacao_id
          WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?`,
        [instituicaoId(), organizationId, professionalId]
      );
      for (const row of rows) {
        const rawStatus = String(row.status);
        const statusNorm: 'agendado' | 'realizado' | 'cancelado' =
          rawStatus === 'realizado' ? 'realizado' :
          rawStatus === 'cancelado' ? 'cancelado' : 'agendado';
        const dur = Number(row.duracao_min) || 50;
        const fim = row.fim
          ? new Date(row.fim).toISOString()
          : new Date(new Date(row.inicio).getTime() + dur * 60_000).toISOString();
        const entry = {
          appointmentId: String(row.id),
          attendanceStatus: statusNorm,
          startsAt: new Date(row.inicio).toISOString(),
          endsAt: fim,
          modalidade: (row.modalidade === 'presencial' ? 'presencial' : row.modalidade === 'telefone' ? 'telefone' : 'online') as 'online' | 'presencial' | 'telefone',
        };
        if (row.id) appointmentsMap.set(String(row.id), entry);
        if (row.ref_core) appointmentsMap.set(String(row.ref_core), entry);
        if (row.sessao_clinica_ref) appointmentsMap.set(String(row.sessao_clinica_ref), entry);
      }
    } catch (err) {
      console.error('[financial] Falha ao enriquecer atendimentos via MySQL:', err);
    }
  }

  // O razão já chega filtrado pelo perfil profissional. Conciliar aqui, antes
  // de expor os dados, permite ao psicólogo acompanhar cada atendimento sem
  // receber cobranças ou pacientes de outros profissionais.
  const receivables = reconcileSessionReceivables(ledger)
    .map((receivable) => {
      const apt = appointmentsMap.get(receivable.sessionId);
      return {
        chargeId: receivable.chargeId,
        sessionId: receivable.sessionId,
        appointmentId: apt?.appointmentId ?? receivable.sessionId,
        patientName: names.get(receivable.patientId) ?? 'Paciente',
        dueAt: receivable.dueAt,
        startsAt: apt?.startsAt ?? receivable.dueAt,
        endsAt: apt?.endsAt,
        status: receivable.chargeStatus as ChargeStatus,
        attendanceStatus: apt?.attendanceStatus ?? (receivable.chargeStatus === 'paid' ? 'realizado' : 'agendado'),
        modalidade: apt?.modalidade ?? 'online',
        amountCents: receivable.netAmountCents,
        receivedCents: Math.max(receivable.paidAmountCents - receivable.refundedAmountCents, 0),
        outstandingCents: receivable.outstandingAmountCents,
      };
    })
    .sort((left, right) => right.dueAt.localeCompare(left.dueAt));

  return {
    professionalId,
    receivedCents: transactions.reduce((sum, item) => sum + item.amountCents, 0),
    professionalCreditCents: transactions.reduce(
      (sum, item) => sum + item.professionalCreditCents, 0
    ),
    transactions,
    receivables,
  };
}

export async function exportFinancialCsvData(
  context: RequestContext,
  filter: FinancialFilter = {}
): Promise<string> {
  const reportBundle = await getFinancialReportsData(context, filter);
  return exportFinancialReportCsv(reportBundle);
}

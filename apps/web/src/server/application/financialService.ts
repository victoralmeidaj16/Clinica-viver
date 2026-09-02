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
import { readSnapshot } from './persistence';

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
    conveniado?: boolean;
    convenioNome?: string;
    custeadoPelaEmpresa?: boolean;
  }>();

  const conveniosByPatient = new Map<string, {
    conveniado: boolean;
    convenioNome?: string;
    custeadoPelaEmpresa?: boolean;
  }>();

  try {
    const snapshot = readSnapshot();
    if (snapshot?.triagensPacientes) {
      for (const lead of snapshot.triagensPacientes) {
        if (lead.pacienteRef && lead.convenioSelecionado && lead.convenioSelecionado !== 'NENHUM') {
          conveniosByPatient.set(lead.pacienteRef, {
            conveniado: true,
            convenioNome: lead.convenioSelecionado,
            custeadoPelaEmpresa: true,
          });
        }
      }
    }
  } catch (err) {
    console.warn('[financial] Erro ao ler triagens do snapshot:', err);
  }

  try {
    const appointments = await store.appointments.list({ organizationId, professionalId });
    for (const apt of appointments) {
      const fimDate = new Date(apt.endsAt || apt.startsAt);
      const jaOcorreu = fimDate.getTime() <= Date.now();
      const statusNorm: 'agendado' | 'realizado' | 'cancelado' =
        apt.status === 'completed' || jaOcorreu ? 'realizado' :
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
      const pool = getMysqlPool();
      // Auto-sincroniza agendamentos passados para status 'realizado'
      await pool.execute(
        `UPDATE clinica_agendamentos a
           JOIN clinica_profissionais p ON p.id = a.profissional_id
           JOIN clinica_organizacoes o ON o.id = p.organizacao_id
            SET a.status = 'realizado',
                a.realizado_em = COALESCE(a.realizado_em, COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE))),
                a.versao = a.versao + 1,
                a.atualizado_em = CURRENT_TIMESTAMP(3)
          WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?
            AND a.status IN ('agendado', 'confirmado')
            AND COALESCE(a.fim, DATE_ADD(a.inicio, INTERVAL a.duracao_min MINUTE)) <= NOW()`,
        [instituicaoId(), organizationId, professionalId]
      ).catch(() => {});

      // Convênios dos pacientes da clínica
      const [patientRows] = await pool.query<RowDataPacket[]>(
        `SELECT pa.ref_core, conv.nome AS convenio_nome,
                CASE WHEN pa.convenio_ref IS NOT NULL OR conv.nome IS NOT NULL THEN 1 ELSE 0 END AS conveniado,
                CASE WHEN pa.convenio_ref IS NULL THEN 0
                     ELSE COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) END
                  AS custeado_pela_empresa
           FROM clinica_pacientes pa
           JOIN clinica_organizacoes o ON o.id = pa.organizacao_id
           LEFT JOIN clinica_convenios conv
             ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
            AND conv.ref_core = pa.convenio_ref
          WHERE pa.instituicao_id = ? AND o.ref_core = ?`,
        [instituicaoId(), organizationId]
      );
      for (const row of patientRows) {
        if (row.ref_core) {
          conveniosByPatient.set(String(row.ref_core), {
            conveniado: Boolean(row.conveniado),
            convenioNome: row.convenio_nome ? String(row.convenio_nome) : undefined,
            custeadoPelaEmpresa: Boolean(row.custeado_pela_empresa),
          });
        }
      }

      // Agendamentos detalhados com vínculo de convênio
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT a.id, a.ref_core, a.sessao_clinica_ref, a.status, a.inicio, a.fim, a.duracao_min, a.modalidade,
                pa.ref_core AS paciente_ref,
                conv.nome AS convenio_nome,
                CASE WHEN pa.convenio_ref IS NOT NULL OR conv.nome IS NOT NULL THEN 1 ELSE 0 END AS conveniado,
                CASE WHEN pa.convenio_ref IS NULL THEN 0
                     ELSE COALESCE(pa.custeado_pela_empresa, conv.empresa_paga_sessoes, 1) END
                  AS custeado_pela_empresa
           FROM clinica_agendamentos a
           JOIN clinica_profissionais p ON p.id = a.profissional_id
           JOIN clinica_organizacoes o ON o.id = p.organizacao_id
           JOIN clinica_pacientes pa ON pa.id = a.paciente_id
           LEFT JOIN clinica_convenios conv
             ON conv.instituicao_id = pa.instituicao_id AND conv.organizacao_ref = o.ref_core
            AND conv.ref_core = pa.convenio_ref
          WHERE a.instituicao_id = ? AND o.ref_core = ? AND p.ref_core = ?`,
        [instituicaoId(), organizationId, professionalId]
      );
      for (const row of rows) {
        const rawStatus = String(row.status);
        const dur = Number(row.duracao_min) || 50;
        const fimDate = row.fim
          ? new Date(row.fim)
          : new Date(new Date(row.inicio).getTime() + dur * 60_000);
        const jaOcorreu = fimDate.getTime() <= Date.now();
        const statusNorm: 'agendado' | 'realizado' | 'cancelado' =
          rawStatus === 'cancelado' ? 'cancelado' :
          (rawStatus === 'realizado' || jaOcorreu) ? 'realizado' : 'agendado';

        const isConveniado = Boolean(row.conveniado || row.convenio_nome);
        const entry = {
          appointmentId: String(row.id),
          attendanceStatus: statusNorm,
          startsAt: new Date(row.inicio).toISOString(),
          endsAt: fimDate.toISOString(),
          modalidade: (row.modalidade === 'presencial' ? 'presencial' : row.modalidade === 'telefone' ? 'telefone' : 'online') as 'online' | 'presencial' | 'telefone',
          conveniado: isConveniado,
          convenioNome: row.convenio_nome ? String(row.convenio_nome) : undefined,
          custeadoPelaEmpresa: Boolean(row.custeado_pela_empresa),
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
      const patientConv = conveniosByPatient.get(receivable.patientId);
      const conveniado = Boolean(apt?.conveniado || patientConv?.conveniado);
      const convenioNome = apt?.convenioNome || patientConv?.convenioNome;
      const custeadoPelaEmpresa = Boolean(apt?.custeadoPelaEmpresa ?? patientConv?.custeadoPelaEmpresa);

      const duePassed = Date.parse(receivable.dueAt) <= Date.now();
      const attendanceStatus = apt?.attendanceStatus ?? (receivable.chargeStatus === 'paid' || duePassed ? 'realizado' : 'agendado');

      return {
        chargeId: receivable.chargeId,
        sessionId: receivable.sessionId,
        appointmentId: apt?.appointmentId ?? receivable.sessionId,
        patientName: names.get(receivable.patientId) ?? 'Paciente',
        dueAt: receivable.dueAt,
        startsAt: apt?.startsAt ?? receivable.dueAt,
        endsAt: apt?.endsAt,
        status: receivable.chargeStatus as ChargeStatus,
        attendanceStatus,
        modalidade: apt?.modalidade ?? 'online',
        conveniado,
        convenioNome,
        custeadoPelaEmpresa,
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

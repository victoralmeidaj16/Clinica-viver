import { randomUUID } from 'node:crypto';
import type { Pool } from 'mysql2/promise';
import { createPatientProfile, type FinancialCharge } from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { MysqlIdentityRepository } from '@/server/persistence/mysql/identityRepository';
import { MysqlAppointmentRepository } from '@/server/persistence/mysql/appointmentRepository';
import { MysqlFinancialRepository } from '@/server/persistence/mysql/financialRepository';
import { MysqlCaptureRepository } from '@/server/persistence/mysql/captureRepository';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import type { RequestContext } from '@/server/application/context';

export const org = 'org-viver-mais';
export const when = '2026-10-28T12:00:00.000Z';

export function auditPool(): Pool {
  const value = process.env.AUDIT_MYSQL_URL;
  if (!value) throw new Error('Configure AUDIT_MYSQL_URL para um banco descartável.');
  const url = new URL(value);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/viver_audit_tests') {
    throw new Error('A auditoria aceita somente 127.0.0.1/viver_audit_tests.');
  }
  process.env.DATABASE_URL = value;
  process.env.ORGANIZATION_ID = org;
  process.env.ORGANIZATION_SLUG = 'viver-mais-psicologia';
  return getMysqlPool();
}

export async function fixture() {
  const pool = auditPool();
  const suffix = randomUUID();
  const pro = `pro-${suffix}`, other = `other-${suffix}`, patientId = `patient-${suffix}`;
  const identities = new MysqlIdentityRepository(pool);
  const appointments = new MysqlAppointmentRepository(pool);
  const financial = new MysqlFinancialRepository(pool);
  const capture = new MysqlCaptureRepository(pool);
  for (const id of [pro, other]) await identities.saveProfessional({
    id, organizationId: org, userId: `user-${id}`, displayName: 'Profissional fictício',
    councilType: 'CRP', councilRegistration: '00/00000', specialties: [], status: 'active',
    createdAt: when, updatedAt: when,
  });
  await capture.mutate((state) => ({ next: { ...state, cadastrosPsicologos: [
    ...state.cadastrosPsicologos,
    ...[pro, other].map((id) => ({
      id: `cad-${id}`, profissionalRef: id, nomeCompleto: 'Profissional fictício',
      crp: '00/00000', whatsapp: '', status: 'EM_ANALISE' as const,
      criadoEm: when, limitePacientesAtivos: 5,
    })),
  ] }, result: null }));
  const patient = createPatientProfile({ id: patientId, organizationId: org,
    displayName: 'Paciente fictício', primaryProfessionalId: pro, assignedProfessionalIds: [pro], createdAt: when });
  await identities.savePatient(patient);
  const context: RequestContext = { actor: { actorType: 'staff', membershipStatus: 'active',
    membershipId: 'audit-member', organizationId: org, userId: 'audit-user', roles: ['professional'],
    professionalProfileId: pro }, idempotencyKey: `audit-${suffix}`, correlationId: `audit-${suffix}` };
  const charge: FinancialCharge = { id: `charge-${suffix}`, organizationId: org, sessionId: `session-${suffix}`,
    patientId, professionalId: pro, amountCents: 10000, status: 'pending', issuedAt: when,
    dueAt: '2030-01-01T12:00:00.000Z', createdAt: when, updatedAt: when };
  return { pool, pro, other, patient, identities, appointments, financial, capture, context, charge,
    store: { identities, appointments, financial, preferences: [], consents: [] } };
}

export async function seedAppointment(f: Awaited<ReturnType<typeof fixture>>) {
  const id = `appointment-${randomUUID()}`;
  await f.pool.execute(`INSERT INTO clinica_agendamentos
    (id, instituicao_id, ref_core, organizacao_id, paciente_id, profissional_id,
     inicio, fim, duracao_min, modalidade, status, versao)
    VALUES (?, ?, ?, ?, ?, ?, '2030-01-01 12:00:00', '2030-01-01 12:50:00', 50, 'online', 'agendado', 1)`,
  [rowId('agendamento', id), instituicaoId(), id, rowId('organizacao', org),
    rowId('paciente', f.patient.id), rowId('profissional', f.pro)]);
  return id;
}

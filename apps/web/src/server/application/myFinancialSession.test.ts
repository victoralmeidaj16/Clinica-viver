import { beforeEach, expect, it, vi } from 'vitest';
import { createStaffAccessContext, InMemoryFinancialRepository } from '@thats-life/core';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ store: vi.fn(), query: vi.fn(), mysql: false }));
vi.mock('./store', () => ({ getApplicationStore: mocks.store }));
vi.mock('./persistence', () => ({ readSnapshot: () => null }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => mocks.mysql, getMysqlPool: () => ({ query: mocks.query }) }));
import { getMyFinancialData } from './financialService';
const now = '2026-10-27T12:00:00Z';
const context = { actor: createStaffAccessContext({ id: 'member-test', userId: 'user-test', organizationId: 'org-test',
  roles: ['professional'], status: 'active', professionalProfileId: 'pro-test', createdAt: now, updatedAt: now }), correlationId: 'test' };
beforeEach(() => {
  mocks.mysql = false;
  const financial = new InMemoryFinancialRepository({ charges: [{ id: 'charge-test', organizationId: 'org-test',
    sessionId: 'appointment-test', patientId: 'patient-test', professionalId: 'pro-test', amountCents: 10000,
    status: 'pending', issuedAt: now, dueAt: now, createdAt: now, updatedAt: now }] });
  mocks.store.mockReturnValue({ financial, identities: { listPatients: async () => [{ id: 'patient-test', displayName: 'Paciente fictício' }] },
    appointments: { list: async () => [{ id: 'appointment-test', status: 'scheduled', startsAt: now, endsAt: '2026-10-27T13:30:00Z',
      serviceKey: 'AVALIACAO', version: 3, mode: 'video' }] } });
});
it('leva serviço e versão do agendamento até o financeiro do psicólogo', async () => {
  expect((await getMyFinancialData(context)).receivables).toMatchObject([{ serviceKey: 'AVALIACAO', versao: 3 }]);
});
it('preserva os metadados mais recentes do MySQL usados para editar a avaliação', async () => {
  mocks.mysql = true;
  mocks.query.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_agendamentos a') ? [{
    id: 'appointment-db', ref_core: 'appointment-test', status: 'agendado', inicio: now, fim: '2026-10-27T13:30:00Z',
    modalidade: 'online', servico_key: 'AVALIACAO', versao: 4,
  }] : [], []]);
  expect((await getMyFinancialData(context)).receivables).toMatchObject([{ appointmentId: 'appointment-db', serviceKey: 'AVALIACAO', versao: 4 }]);
});
it('interpreta o texto UTC do MySQL sem deslocar o horário no fuso da clínica', async () => {
  const previous = process.env.TZ;
  process.env.TZ = 'America/Sao_Paulo';
  try {
    mocks.mysql = true;
    mocks.query.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_agendamentos a') ? [{
      id: 'appointment-db', ref_core: 'appointment-test', status: 'agendado', inicio: '2026-10-27 12:00:00.000',
      fim: '2026-10-27 13:30:00.000', modalidade: 'online', servico_key: 'AVALIACAO', versao: 4,
    }] : [], []]);
    expect((await getMyFinancialData(context)).receivables[0]).toMatchObject({
      startsAt: '2026-10-27T12:00:00.000Z', endsAt: '2026-10-27T13:30:00.000Z',
    });
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

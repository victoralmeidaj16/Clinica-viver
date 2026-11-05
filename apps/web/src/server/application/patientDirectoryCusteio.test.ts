import { beforeEach, expect, it, vi } from 'vitest';
import { createPatientProfile, type PatientProfile } from '@thats-life/core';
import type { RequestContext } from './context';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  patients: [] as PatientProfile[],
  rows: [] as Record<string, unknown>[],
  leads: [] as Record<string, unknown>[],
  query: vi.fn(),
}));
vi.mock('./viverMaisWhatsApp', () => ({ avisarConfirmacaoPaciente: vi.fn() }));
vi.mock('./store', () => ({
  getApplicationStore: () => ({
    appointments: { list: async () => [] },
    identities: { listPatients: async () => state.patients, getProfessional: async () => null },
  }),
  persistApplicationState: vi.fn(async () => {}),
}));
vi.mock('@/server/persistence/captureRepository', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/server/persistence/captureRepository')>(),
  getCaptureRepository: () => ({ read: async () => ({ triagensPacientes: state.leads, cadastrosPsicologos: [] }) }),
}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: () => ({ query: state.query }) }));
vi.mock('./persistence', async (importOriginal) => ({
  ...await importOriginal<typeof import('./persistence')>(), readSnapshot: () => null,
}));

import { custeioEfetivoSql } from '@/server/persistence/mysql/custeioSql';
import { listPatientDirectory } from './patientDirectory';

const context = {
  actor: {
    actorType: 'staff', membershipStatus: 'active', membershipId: 'member-1',
    userId: 'user-test', organizationId: 'org-test', roles: ['admin'],
  },
  correlationId: 'correlation-test',
} as unknown as RequestContext;

const paciente = (id: string) => createPatientProfile({
  id, organizationId: 'org-test', displayName: 'Paciente fictício', primaryProfessionalId: 'pro-test',
  assignedProfessionalIds: ['pro-test'], createdAt: '2026-01-01T12:00:00.000Z',
});

const custeioDe = async (id: string) =>
  (await listPatientDirectory(context)).find((patient) => patient.id === id)?.custeioAoAgendar;

beforeEach(() => {
  state.patients = [paciente('pac-1')];
  state.rows = [];
  state.leads = [];
  state.query.mockReset();
  state.query.mockImplementation(async () => [state.rows, []]);
});

it('usa a mesma regra de custeio que decide a cobrança da sessão', async () => {
  await listPatientDirectory(context);
  expect(state.query.mock.calls[0][0]).toContain(custeioEfetivoSql({ paciente: 'p', convenio: 'c' }));
});

it('classifica o custeio de cada paciente a partir do cálculo efetivo', async () => {
  state.rows = [{ ref_core: 'pac-1', convenio_ref: 'conv-1', custeado_efetivo: 1, custeio_sessoes_cota: null }];
  expect(await custeioDe('pac-1')).toBe('empresa');

  state.rows = [{ ref_core: 'pac-1', convenio_ref: 'conv-1', custeado_efetivo: 1, custeio_sessoes_cota: 4 }];
  expect(await custeioDe('pac-1')).toBe('empresa_com_limite');

  state.rows = [{ ref_core: 'pac-1', convenio_ref: 'conv-1', custeado_efetivo: 0, custeio_sessoes_cota: 4 }];
  expect(await custeioDe('pac-1')).toBe('paciente');
});

it('convênio só declarado na triagem não dispensa o vencimento: a sessão será cobrada', async () => {
  state.leads = [{ pacienteRef: 'pac-1', possuiConvenio: 'SIM', convenioSelecionado: 'Convênio fictício' }];
  state.rows = [{ ref_core: 'pac-1', convenio_ref: null, custeado_efetivo: 0, custeio_sessoes_cota: null }];
  const [entrada] = await listPatientDirectory(context);
  expect(entrada).toMatchObject({ conveniado: true, custeioAoAgendar: 'paciente' });
});

it('sem dados de convênio, não afirma que a empresa paga', async () => {
  state.query.mockRejectedValue(new Error('Falha de consulta fictícia.'));
  expect(await custeioDe('pac-1')).toBeUndefined();
});

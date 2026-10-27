import { beforeEach, expect, it, vi } from 'vitest';
import type { RequestContext } from './context';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ save: vi.fn(), contact: vi.fn(), mutate: vi.fn(), query: vi.fn(), checkCpf: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
vi.mock('@/server/persistence/mysql/patientCpfUniqueness', () => ({ assertPatientCpfAvailable: state.checkCpf }));
vi.mock('./store', () => ({ getApplicationStore: () => ({ identities: {
  getPatient: async () => null, getProfessional: async () => ({ displayName: 'Profissional fictício' }),
  savePatient: state.save, savePatientContact: state.contact,
} }), persistApplicationState: async () => {} }));
vi.mock('@/server/persistence/captureRepository', async (original) => ({
  ...await original<typeof import('@/server/persistence/captureRepository')>(),
  getCaptureRepository: () => ({ mutateAtomic: state.mutate }),
}));
import { createPatient } from './patientDirectory';

const context: RequestContext = { actor: { actorType: 'staff', membershipStatus: 'active', membershipId: 'member',
  organizationId: 'org', userId: 'user', roles: ['professional'], professionalProfileId: 'pro' },
  idempotencyKey: 'command', correlationId: 'correlation' };
const body = { nome: 'Paciente fictício', legalName: 'Paciente fictício', whatsapp: '(11) 99999-9999',
  email: 'paciente@example.invalid', cpf: '52998224725', genero: 'FEMININO', servicoKey: 'PSICOTERAPIA',
  modalidade: 'SOCIAL', turno: 'TARDE', cep: '01310100', logradouro: 'Rua fictícia', numeroResidencia: '1',
  bairro: 'Centro', cidade: 'São Paulo', uf: 'SP' };

beforeEach(() => {
  vi.resetAllMocks();
  state.query.mockResolvedValue([[]]);
  state.mutate.mockImplementation(async (callback) => (await callback({ triagensPacientes: [], cadastrosPsicologos: [] },
    { query: state.query })).result);
});

it('grava perfil, contato e triagem pela mesma transação de captação', async () => {
  await createPatient(context, body);
  const connection = state.save.mock.calls[0][1];
  expect(state.contact.mock.calls[0][2]).toBe(connection);
  expect(state.checkCpf).toHaveBeenCalledWith(connection, 'org', expect.any(String), body.cpf);
  expect(state.mutate).toHaveBeenCalledWith(expect.any(Function), 'org');
});

it('não grava o perfil se o CPF já estiver em outro cadastro', async () => {
  state.checkCpf.mockRejectedValue(new Error('CPF duplicado'));
  await expect(createPatient(context, body)).rejects.toThrow('CPF duplicado');
  expect(state.save).not.toHaveBeenCalled();
  expect(state.contact).not.toHaveBeenCalled();
});

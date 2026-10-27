import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({ mutate: vi.fn(), execute: vi.fn(), checkCpf: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ mutateAtomic: state.mutate }) }));
vi.mock('@/server/persistence/mysql/patientCpfUniqueness', () => ({ assertPatientCpfAvailable: state.checkCpf }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst' }));
vi.mock('./store', () => ({ getApplicationStore: vi.fn() }));
import { definirCpfDoPaciente } from './patientFiscalIdentity';

beforeEach(() => {
  vi.resetAllMocks();
  state.execute.mockResolvedValue([{ affectedRows: 1 }]);
  state.mutate.mockImplementation(async (callback) => (await callback({ cadastrosPsicologos: [], triagensPacientes: [
    { id: 'lead', pacienteRef: 'patient' }, { id: 'lead-2', pacienteRef: 'patient' },
  ] }, { execute: state.execute })).result);
});

it('atualiza o CPF no cadastro e na triagem sob a mesma transação', async () => {
  await expect(definirCpfDoPaciente('org', 'patient', '52998224725')).resolves.toMatchObject({ gravadoEm: ['cadastro', 'triagem'] });
  expect(state.checkCpf).toHaveBeenCalledWith(expect.anything(), 'org', 'patient', '52998224725');
  expect(state.execute).toHaveBeenCalledOnce();
});

it('não grava CPF fiscal duplicado', async () => {
  state.checkCpf.mockRejectedValue(new Error('CPF duplicado'));
  await expect(definirCpfDoPaciente('org', 'patient', '52998224725')).rejects.toThrow('CPF duplicado');
  expect(state.execute).not.toHaveBeenCalled();
});

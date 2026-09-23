import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditoriaDesistenciaRecord } from '@/server/application/persistence';
import type { CaptureResult, CaptureState } from '@/server/persistence/captureRepository';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  records: [] as AuditoriaDesistenciaRecord[],
  capture: { triagensPacientes: [], cadastrosPsicologos: [] } as CaptureState,
  reassign: vi.fn(), savePatient: vi.fn(), writeSnapshot: vi.fn(),
  allocate: vi.fn(), compatible: vi.fn(),
}));
vi.mock('@/server/auth', () => ({
  readSession: async () => ({ organizationId: 'org-test', userId: 'admin-test' }),
}));
vi.mock('@/server/viverMaisGestaoAuth', () => ({
  exigirGestao: async () => {}, NaoAutorizadoError: class extends Error {},
}));
vi.mock('@/server/application/store', () => ({
  getApplicationStore: () => ({ identities: {
    getProfessional: async () => ({ status: 'active' }),
    reassignPatient: state.reassign, savePatient: state.savePatient,
  } }),
}));
vi.mock('@/server/application/persistence', () => ({
  readSnapshot: () => ({ auditoriaDesistencias: state.records }),
  emptySnapshot: () => ({}), writeSnapshot: state.writeSnapshot,
}));
vi.mock('@/server/persistence/captureRepository', () => ({
  captureStateAsSnapshot: (capture: CaptureState) => capture,
  getCaptureRepository: () => ({
    read: async () => state.capture,
    mutate: async <T>(callback: (capture: CaptureState) => CaptureResult<T>) => {
      const change = callback(state.capture);
      state.capture = change.next;
      return change.result;
    },
  }),
}));
vi.mock('@/server/application/viverMaisRodizio', () => ({
  listarPsicologosCompativeis: state.compatible,
  alocarLeadParaPsicologo: state.allocate,
}));

import { POST } from './route';

beforeEach(() => {
  vi.resetAllMocks();
  state.records = [{
    id: 'dropout-test', organizationId: 'org-test', pacienteId: 'patient-test',
    pacienteNome: 'Paciente fictício', psicologoNome: 'Profissional anterior',
    motivo: 'FINANCEIRO', dataDesistencia: '2026-09-22T12:00:00.000Z',
    reengajado: false, permitirTrocaPsicologo: true,
  }];
  state.capture = {
    triagensPacientes: [{
      id: 'lead-test', pacienteRef: 'patient-test', protocolo: 'VM-TEST',
      nomePaciente: 'Paciente fictício', telefone: '11999999999',
      convenioSelecionado: 'Nenhum', origem: 'Indicação', turno: 'TARDE',
      status: 'DESISTENTE', psicologoAlocadoId: 'psi-anterior',
      criadoEm: '2026-09-22T12:00:00.000Z',
    }],
    cadastrosPsicologos: [],
  };
  const professional = { id: 'psi-novo', profissionalRef: 'prof-novo', nomeCompleto: 'Profissional novo' };
  state.compatible.mockReturnValue([professional]);
  state.reassign.mockResolvedValue({ id: 'patient-test', status: 'discharged' });
  state.allocate.mockImplementation((snapshot: CaptureState) => ({ snapshot, psicologo: professional }));
});

function allocate() {
  return POST(new Request('http://localhost/api/application/desistencias', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'ALOCAR_PACIENTE', id: 'dropout-test', psicologoId: 'psi-novo' }),
  }));
}

describe('realocação após desistência do psicólogo', () => {
  it.each([undefined, 'lead-test'])('realoca com leadId %s e persiste o vínculo resolvido', async (leadId) => {
    state.records[0].leadId = leadId;
    const response = await allocate();
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, data: { leadId: 'lead-test', reengajado: true } });
    expect(state.reassign).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-test', patientId: 'patient-test', professionalId: 'prof-novo',
    }));
    expect(state.savePatient).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
    expect(state.allocate).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({ id: 'lead-test', pacienteRef: 'patient-test' }), 'psi-novo', expect.any(String));
    expect(state.writeSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      auditoriaDesistencias: [expect.objectContaining({ leadId: 'lead-test', reengajado: true })],
    }));
  });

  it.each([undefined, 'lead-test'])('recusa triagem de outro paciente com leadId %s', async (leadId) => {
    state.records[0].leadId = leadId;
    state.capture.triagensPacientes[0].pacienteRef = 'outro-paciente';
    expect((await allocate()).status).toBe(404);
    expect(state.reassign).not.toHaveBeenCalled();
    expect(state.writeSnapshot).not.toHaveBeenCalled();
  });

  it('mantém a exigência de consentimento ao recuperar um vínculo antigo', async () => {
    state.records[0].permitirTrocaPsicologo = false;
    expect((await allocate()).status).toBe(409);
    expect(state.reassign).not.toHaveBeenCalled();
  });

  it('mantém a verificação de compatibilidade do profissional', async () => {
    state.compatible.mockReturnValue([]);
    expect((await allocate()).status).toBe(409);
    expect(state.reassign).not.toHaveBeenCalled();
  });

  it('não recupera vínculo de registro de outra organização', async () => {
    state.records[0].organizationId = 'outra-organizacao';
    expect((await allocate()).status).toBe(404);
    expect(state.reassign).not.toHaveBeenCalled();
  });
});

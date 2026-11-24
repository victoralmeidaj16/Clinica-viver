import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditoriaDesistenciaRecord } from '@/server/application/persistence';
import type { CaptureResult, CaptureState } from '@/server/persistence/captureRepository';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  records: [] as AuditoriaDesistenciaRecord[],
  capture: { triagensPacientes: [], cadastrosPsicologos: [] } as CaptureState,
  reassign: vi.fn(), savePatient: vi.fn(), writeSnapshot: vi.fn(),
  allocate: vi.fn(), compatible: vi.fn(),
  avisarConfirmacaoPaciente: vi.fn(), avisarAlocacao: vi.fn(), avisarEmail: vi.fn(),
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
  recalcularPacientesAtivos: (s: unknown) => s,
}));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  avisarConfirmacaoPaciente: state.avisarConfirmacaoPaciente,
  avisarAlocacao: state.avisarAlocacao,
}));
vi.mock('@/server/application/triagemEmail', () => ({
  avisarAlocacaoPsicologoPorEmail: state.avisarEmail,
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

  it('avisa o paciente no vínculo direto e apenas o psicólogo ao escolher PEDIR_ACEITE', async () => {
    const direto = await allocate();
    expect(direto.status).toBe(200);
    expect(state.avisarConfirmacaoPaciente).toHaveBeenCalledTimes(1);
    expect(state.avisarAlocacao).not.toHaveBeenCalled();

    vi.clearAllMocks();
    state.records[0].reengajado = false;
    state.compatible.mockReturnValue([{ id: 'psi-novo', profissionalRef: 'prof-novo', nomeCompleto: 'Profissional novo' }]);
    state.allocate.mockImplementation((snapshot: CaptureState) => ({
      snapshot,
      lead: state.capture.triagensPacientes[0],
      psicologo: { id: 'psi-novo', profissionalRef: 'prof-novo', nomeCompleto: 'Profissional novo', pacientesAtivosCount: 1, limitePacientesAtivos: 5 },
    }));

    const aceite = await POST(new Request('http://localhost/api/application/desistencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ALOCAR_PACIENTE',
        id: 'dropout-test',
        psicologoId: 'psi-novo',
        modo: 'PEDIR_ACEITE',
      }),
    }));
    expect(aceite.status).toBe(200);
    expect(state.reassign).not.toHaveBeenCalled();
    expect(state.avisarConfirmacaoPaciente).not.toHaveBeenCalled();
    expect(state.avisarAlocacao).toHaveBeenCalledTimes(1);
    expect(state.avisarEmail).toHaveBeenCalledTimes(1);
  });

  it('exige autorização e justificativa para alocar em profissional lotado (6 de 5)', async () => {
    state.compatible.mockReturnValue([{
      id: 'psi-novo', profissionalRef: 'prof-novo', nomeCompleto: 'Profissional novo',
      pacientesAtivosCount: 5, limitePacientesAtivos: 5,
    }]);

    const semAutorizacao = await allocate();
    expect(semAutorizacao.status).toBe(409);

    const semJustificativa = await POST(new Request('http://localhost/api/application/desistencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ALOCAR_PACIENTE',
        id: 'dropout-test',
        psicologoId: 'psi-novo',
        excederLimite: true,
        justificativaExcesso: '  ',
      }),
    }));
    expect(semJustificativa.status).toBe(400);

    state.allocate.mockImplementation((snapshot: CaptureState) => ({
      snapshot,
      lead: state.capture.triagensPacientes[0],
      psicologo: { id: 'psi-novo', profissionalRef: 'prof-novo', nomeCompleto: 'Profissional novo', pacientesAtivosCount: 6, limitePacientesAtivos: 5 },
    }));
    const autorizado = await POST(new Request('http://localhost/api/application/desistencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ALOCAR_PACIENTE',
        id: 'dropout-test',
        psicologoId: 'psi-novo',
        excederLimite: true,
        justificativaExcesso: 'Retorno autorizado pela gestão.',
      }),
    }));
    expect(autorizado.status).toBe(200);
    await expect(autorizado.json()).resolves.toMatchObject({
      success: true,
      data: { observacoesReengajamento: expect.stringContaining('exceção de limite (6 de 5): Retorno autorizado pela gestão.') },
    });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryClinicalSessionRepository, scheduleClinicalSession, type ClinicalSessionStatus } from '@thats-life/core';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({ store: vi.fn(), read: vi.fn(), registrar: vi.fn(), ledger: vi.fn() }));
vi.mock('./store', () => ({ getApplicationStore: mocks.store }));
vi.mock('@/server/persistence/captureRepository', () => ({ getCaptureRepository: () => ({ read: mocks.read }) }));
vi.mock('@/server/declaracao/declaracaoHorasRepository', () => ({
  exigirPersistenciaDeclaracao: vi.fn(),
  DeclaracaoHorasRepository: class { registrar = mocks.registrar; },
}));

import { emitirDeclaracao, previaDeclaracao } from './declaracaoHorasService';

function sessao(id: string, status: ClinicalSessionStatus, professionalId = 'pro-ficticio', organizationId = 'org-ficticia') {
  const criadoEm = '2026-10-01T12:00:00Z';
  return { ...scheduleClinicalSession({ id, organizationId, patientId: 'paciente-ficticio',
    primaryProfessionalId: professionalId, assignedProfessionalIds: [professionalId], mode: 'video',
    scheduledStart: '2026-10-02T12:00:00Z', scheduledEnd: '2026-10-02T12:50:00Z', createdAt: criadoEm,
    automationPlan: { transcription: false, patientHandoff: false, billing: false, receipt: false, notification: false },
  }, { actorUserId: 'user-ficticio', occurredAt: criadoEm, correlationId: 'teste' }).session,
  status, artifacts: { chargeId: `cobranca-${id}` } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ triagensPacientes: [], cadastrosPsicologos: [{
    id: 'cad-ficticio', profissionalRef: 'pro-ficticio', nomeCompleto: 'Profissional fictício', crp: '00/00000',
    posGraduacaoViverMais: 'Curso fictício', turmaViverMais: 'Turma fictícia',
  }] });
  mocks.registrar.mockImplementation(async (input) => ({ ...input, codigo: 'VM-TEST-TEST', emitidoEm: '2026-11-04T12:00:00Z' }));
  mocks.ledger.mockRejectedValue(new Error('A contagem não deve depender de leitura do financeiro.'));
});

describe('sessões confirmadas na declaração de estágio', () => {
  function carteira() {
    const sessions = new InMemoryClinicalSessionRepository([
      sessao('confirmada-paga', 'completed'), sessao('confirmada-nao-paga', 'completed'),
      sessao('em-revisao', 'awaiting_review'), sessao('pronta-para-concluir', 'ready_to_complete'),
      sessao('falta-paga', 'no_show'), sessao('so-agendada', 'confirmed'),
      sessao('outro-profissional', 'completed', 'outro-pro'),
      sessao('outra-organizacao', 'completed', 'pro-ficticio', 'outra-org'),
    ]);
    mocks.store.mockReturnValue({ sessions, financial: { getLedger: mocks.ledger } });
    return sessions;
  }

  it('inclui as confirmadas pagas ou não pagas na prévia, respeitando profissional e organização', async () => {
    const sessions = carteira();
    const list = vi.spyOn(sessions, 'list');
    await expect(previaDeclaracao('org-ficticia', 'cad-ficticio')).resolves.toMatchObject({ totalSessoes: 2, totalHoras: 2 });
    expect(list).toHaveBeenCalledWith({ organizationId: 'org-ficticia', professionalId: 'pro-ficticio', statuses: ['completed'] });
    expect(mocks.ledger).not.toHaveBeenCalled();
  });

  it('registra na emissão somente os ids de atendimentos confirmados', async () => {
    carteira();
    await emitirDeclaracao('org-ficticia', 'gestor-ficticio', 'cad-ficticio');
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({ totalSessoes: 2, totalHoras: 2,
      sessaoIds: ['confirmada-nao-paga', 'confirmada-paga'] }), expect.any(Function));
    expect(mocks.ledger).not.toHaveBeenCalled();
  });

  it('recusa emissão quando existem apenas atendimentos sem confirmação de conclusão', async () => {
    mocks.store.mockReturnValue({ sessions: new InMemoryClinicalSessionRepository([
      sessao('em-revisao', 'awaiting_review'), sessao('pronta-para-concluir', 'ready_to_complete'),
    ]) });
    await expect(emitirDeclaracao('org-ficticia', 'gestor-ficticio', 'cad-ficticio')).rejects.toMatchObject({ status: 422 });
    expect(mocks.registrar).not.toHaveBeenCalled();
  });
});

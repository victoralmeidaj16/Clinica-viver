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

function sessao(
  id: string,
  status: ClinicalSessionStatus,
  professionalId = 'pro-ficticio',
  organizationId = 'org-ficticia',
  scheduledStart = '2026-10-02T12:00:00Z',
  duracaoMin = 50
) {
  const criadoEm = '2026-10-01T12:00:00Z';
  const scheduledEnd = new Date(Date.parse(scheduledStart) + duracaoMin * 60_000).toISOString();
  return { ...scheduleClinicalSession({ id, organizationId, patientId: 'paciente-ficticio',
    primaryProfessionalId: professionalId, assignedProfessionalIds: [professionalId], mode: 'video',
    scheduledStart, scheduledEnd, createdAt: criadoEm,
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

  it('inclui as confirmadas pagas ou não pagas na prévia, somando a duração real das sessões', async () => {
    const sessions = carteira();
    const list = vi.spyOn(sessions, 'list');
    await expect(previaDeclaracao('org-ficticia', 'cad-ficticio')).resolves.toMatchObject({
      totalSessoes: 2,
      totalMinutos: 100,
      totalHoras: 1,
    });
    expect(list).toHaveBeenCalledWith({ organizationId: 'org-ficticia', professionalId: 'pro-ficticio', statuses: ['completed'] });
    expect(mocks.ledger).not.toHaveBeenCalled();
  });

  it('registra na emissão somente os ids e minutos reais de atendimentos confirmados', async () => {
    carteira();
    await emitirDeclaracao('org-ficticia', 'gestor-ficticio', 'cad-ficticio');
    expect(mocks.registrar).toHaveBeenCalledWith(expect.objectContaining({
      totalSessoes: 2,
      totalMinutos: 100,
      totalHoras: 1,
      sessaoIds: ['confirmada-nao-paga', 'confirmada-paga'],
    }), expect.any(Function));
    expect(mocks.ledger).not.toHaveBeenCalled();
  });

  it('recusa emissão quando existem apenas atendimentos sem confirmação de conclusão', async () => {
    mocks.store.mockReturnValue({ sessions: new InMemoryClinicalSessionRepository([
      sessao('em-revisao', 'awaiting_review'), sessao('pronta-para-concluir', 'ready_to_complete'),
    ]) });
    await expect(emitirDeclaracao('org-ficticia', 'gestor-ficticio', 'cad-ficticio')).rejects.toMatchObject({ status: 422 });
    expect(mocks.registrar).not.toHaveBeenCalled();
  });

  it('filtra prévia e emissão pelo período selecionado, somando 50min + 90min = 140min (2h20)', async () => {
    const sessions = new InMemoryClinicalSessionRepository([
      sessao('sessao-set', 'completed', 'pro-ficticio', 'org-ficticia', '2026-09-15T12:00:00Z', 50),
      sessao('sessao-out-1', 'completed', 'pro-ficticio', 'org-ficticia', '2026-10-05T12:00:00Z', 50),
      sessao('sessao-out-2', 'completed', 'pro-ficticio', 'org-ficticia', '2026-10-20T12:00:00Z', 90),
      sessao('sessao-nov', 'completed', 'pro-ficticio', 'org-ficticia', '2026-11-10T12:00:00Z', 50),
    ]);
    mocks.store.mockReturnValue({ sessions, financial: { getLedger: mocks.ledger } });

    await expect(
      previaDeclaracao('org-ficticia', 'cad-ficticio', { inicio: '2026-10-01', fim: '2026-10-31' })
    ).resolves.toMatchObject({
      totalSessoes: 2,
      totalMinutos: 140,
      totalHoras: 2,
      periodoInicio: '2026-10-05',
      periodoFim: '2026-10-20',
    });

    await expect(
      previaDeclaracao('org-ficticia', 'cad-ficticio', { inicio: '2026-11-01', fim: '2026-10-01' })
    ).rejects.toMatchObject({ status: 400 });

    await expect(
      previaDeclaracao('org-ficticia', 'cad-ficticio', { inicio: '2026-12-01', fim: '2026-12-31' })
    ).rejects.toMatchObject({ status: 422 });

    await emitirDeclaracao('org-ficticia', 'gestor-ficticio', 'cad-ficticio', {
      psicologoNome: 'Profissional fictício',
      psicologoCrp: '00/00000',
      tratamento: 'Pós-Graduando(a)',
      curso: 'Curso fictício — Turma Turma fictícia',
      periodoInicio: '2026-10-01',
      periodoFim: '2026-10-31',
      totalHoras: 2,
      totalMinutos: 140,
      coordenadora: 'COORDENADORA TESTE',
    });
    expect(mocks.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        totalSessoes: 2,
        totalHoras: 2,
        totalMinutos: 140,
        periodoInicio: '2026-10-01',
        periodoFim: '2026-10-31',
        sessaoIds: ['sessao-out-1', 'sessao-out-2'],
      }),
      expect.any(Function)
    );
  });
});

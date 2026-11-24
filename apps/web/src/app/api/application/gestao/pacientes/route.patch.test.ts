import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CadastroPsicologoRecord, TriagemPacienteRecord } from '@/server/application/persistence';
import type { CaptureResult, CaptureState } from '@/server/persistence/captureRepository';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  capture: { triagensPacientes: [] as TriagemPacienteRecord[], cadastrosPsicologos: [] as CadastroPsicologoRecord[] } as CaptureState,
  promoverLeadEmPaciente: vi.fn(),
  avisarConfirmacaoPaciente: vi.fn(),
  avisarAlocacao: vi.fn(),
  avisarTransbordo: vi.fn(),
  avisarAlocacaoPsicologoPorEmail: vi.fn(),
}));

vi.mock('@/server/auth', () => ({ readSession: async () => null }));
vi.mock('@/server/viverMaisGestaoAuth', () => ({
  exigirGestao: async () => {},
  NaoAutorizadoError: class extends Error { status = 403; },
}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => false, getMysqlPool: vi.fn() }));
vi.mock('@/server/persistence/captureRepository', () => ({
  captureStateAsSnapshot: (capture: CaptureState) => capture,
  getCaptureRepository: () => ({
    read: async () => mocks.capture,
    mutate: async <T>(callback: (capture: CaptureState) => CaptureResult<T>) => {
      const change = callback(mocks.capture);
      mocks.capture = change.next;
      return change.result;
    },
  }),
}));
vi.mock('@/server/application/patientPromotion', () => ({
  promoverLeadEmPaciente: mocks.promoverLeadEmPaciente,
}));
vi.mock('@/server/application/viverMaisWhatsApp', () => ({
  avisarConfirmacaoPaciente: mocks.avisarConfirmacaoPaciente,
  avisarAlocacao: mocks.avisarAlocacao,
  avisarTransbordo: mocks.avisarTransbordo,
}));
vi.mock('@/server/application/triagemEmail', () => ({
  avisarAlocacaoPsicologoPorEmail: mocks.avisarAlocacaoPsicologoPorEmail,
}));

import { PATCH } from './route';

function lead(id: string, extras: Partial<TriagemPacienteRecord> = {}): TriagemPacienteRecord {
  return {
    id,
    protocolo: `VM-${id}`,
    nomePaciente: 'Paciente Fictício',
    telefone: '48999990000',
    convenioSelecionado: 'Nenhum',
    origem: 'Site',
    turno: 'TARDE',
    modalidade: 'PARTICULAR',
    servicoKey: 'PSICOTERAPIA',
    paraQuemE: 'Adulto',
    status: 'PENDENTE_ATRIBUICAO',
    criadoEm: '2026-11-23T12:00:00.000Z',
    ...extras,
  };
}

describe('PATCH /api/application/gestao/pacientes — vínculo direto e exceção de limite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.promoverLeadEmPaciente.mockResolvedValue('paciente-lead-novo');
    mocks.capture = {
      cadastrosPsicologos: [
        {
          id: 'psi-1',
          profissionalRef: 'prof-1',
          nomeCompleto: 'Dra. Teste',
          crp: '00/00001',
          whatsapp: '48988880000',
          email: 'psi@example.com',
          status: 'APROVADO',
          criadoEm: '2026-10-01T10:00:00.000Z',
          limitePacientesAtivos: 1,
        },
      ],
      triagensPacientes: [lead('lead-novo')],
    };
  });

  it('vincula diretamente, promove o paciente e envia aviso de confirmação ao paciente (§§ 6.07 e 12.01)', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/application/gestao/pacientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-novo',
          professionalId: 'prof-1',
          motivo: 'Atendimento imediato autorizado pela gestão.',
          modo: 'VINCULAR_DIRETO',
        }),
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      modo: 'VINCULAR_DIRETO',
      ocupacaoResultante: { ativos: 1, limite: 1 },
      data: { status: 'CONTATO_CONFIRMADO', pacienteRef: 'paciente-lead-novo' },
    });
    expect(mocks.promoverLeadEmPaciente).toHaveBeenCalledTimes(1);
    expect(mocks.avisarConfirmacaoPaciente).toHaveBeenCalledTimes(1);
    expect(mocks.avisarAlocacao).not.toHaveBeenCalled();
    expect(mocks.avisarAlocacaoPsicologoPorEmail).toHaveBeenCalledTimes(1);
  });

  it('envia pedido de aceite sem avisar o paciente quando modo é PEDIR_ACEITE', async () => {
    const res = await PATCH(
      new Request('http://localhost/api/application/gestao/pacientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-novo',
          professionalId: 'prof-1',
          motivo: 'Ofertar para avaliação do psicólogo.',
          modo: 'PEDIR_ACEITE',
        }),
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      success: true,
      modo: 'PEDIR_ACEITE',
      data: { status: 'AGUARDANDO_CONTATO' },
    });
    expect(mocks.avisarConfirmacaoPaciente).not.toHaveBeenCalled();
    expect(mocks.avisarAlocacao).toHaveBeenCalledTimes(1);
  });

  it('exige autorização e justificativa quando o limite foi atingido e permite exceção quando justificada', async () => {
    mocks.capture.triagensPacientes = [
      lead('ativo-1', {
        psicologoAlocadoId: 'psi-1',
        status: 'CONTATO_CONFIRMADO',
        aceitoEm: '2026-11-20T10:00:00.000Z',
        confirmadoEm: '2026-11-20T10:00:00.000Z',
      }),
      lead('lead-novo'),
    ];
    mocks.capture.cadastrosPsicologos = [
      { ...mocks.capture.cadastrosPsicologos[0], limitePacientesAtivos: 5 },
    ];
    // Simular limite de 1 usando limitePacientesAtivos: 1
    mocks.capture.cadastrosPsicologos = [
      { ...mocks.capture.cadastrosPsicologos[0], limitePacientesAtivos: 1 },
    ];

    const bloqueado = await PATCH(
      new Request('http://localhost/api/application/gestao/pacientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-novo',
          professionalId: 'prof-1',
          motivo: 'Tentativa sem exceção',
          modo: 'VINCULAR_DIRETO',
        }),
      })
    );
    expect(bloqueado.status).toBe(409);
    await expect(bloqueado.json()).resolves.toMatchObject({ code: 'LIMITE_ATINGIDO', ativos: 1, limite: 1 });

    const liberado = await PATCH(
      new Request('http://localhost/api/application/gestao/pacientes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-novo',
          professionalId: 'prof-1',
          motivo: 'Paciente retornando ao mesmo vínculo',
          modo: 'VINCULAR_DIRETO',
          excederLimite: true,
          justificativaExcesso: 'Exceção autorizada pela coordenação.',
        }),
      })
    );
    expect(liberado.status).toBe(200);
    await expect(liberado.json()).resolves.toMatchObject({
      success: true,
      excedeuLimite: true,
      ocupacaoResultante: { ativos: 2, limite: 1 },
    });
  });
});


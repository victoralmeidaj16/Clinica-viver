import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '@/app/api/application/triagem/[id]/confirmar/route';
import { processarRespostaDoPsicologo } from './viverMaisRespostaPsicologo';

vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  mutate: vi.fn(), read: vi.fn(), avisar: vi.fn(),
}));
vi.mock('@/server/persistence/captureRepository', () => ({
  getCaptureRepository: () => ({ mutate: mocks.mutate, read: mocks.read }),
  captureStateAsSnapshot: (state: unknown) => state,
}));
vi.mock('@/server/viverMaisConfirmToken', () => ({ validarTokenConfirmacao: () => true }));
vi.mock('./patientPromotion', () => ({ reconciliarPacientes: vi.fn() }));
vi.mock('./triagemEmail', () => ({ avisarAlocacaoPsicologoPorEmail: vi.fn() }));
vi.mock('./viverMaisWhatsApp', () => ({
  avisarConfirmacaoPaciente: mocks.avisar,
  avisarTransbordo: vi.fn(), avisarCoordenacao: vi.fn(), responderPsicologo: vi.fn(),
}));

const lead = {
  id: 'lead-1', protocolo: 'VM-123456', nomePaciente: 'Maria', telefone: '11987654321',
  servico: 'Psicoterapia de Casal', modalidade: 'CASAL_PARTICULAR',
  psicologoAlocadoId: 'psi-1', status: 'AGUARDANDO_CONTATO',
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({
    triagensPacientes: [lead],
    cadastrosPsicologos: [{ id: 'psi-1', status: 'APROVADO', whatsapp: '11912345678' }],
  });
});

for (const canal of ['link', 'whatsapp'] as const) {
  describe(`confirmação via ${canal}`, () => {
    async function confirmar() {
      if (canal === 'whatsapp') return processarRespostaDoPsicologo('11912345678', 'CONFIRMAR');
      return POST(new Request('http://localhost/confirmar?psi=psi-1&t=token', { method: 'POST' }), {
        params: Promise.resolve({ id: 'lead-1' }),
      });
    }

    it('envia orientações com os dados do agendamento confirmado', async () => {
      mocks.mutate.mockResolvedValue({ kind: 'confirmed', lead, data: {} });
      await confirmar();
      expect(mocks.avisar).toHaveBeenCalledExactlyOnceWith(lead);
    });

    it.each(['already_confirmed', 'conflict', 'not_found', 'capacity_pending', 'capacity_reallocated'])(
      'não envia orientações quando o resultado é %s', async (kind) => {
        mocks.mutate.mockResolvedValue({ kind, lead, data: {} });
        await confirmar();
        expect(mocks.avisar).not.toHaveBeenCalled();
      }
    );
  });
}

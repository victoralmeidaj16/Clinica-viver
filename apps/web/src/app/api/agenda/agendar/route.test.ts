import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  profile: vi.fn(),
  charge: vi.fn(),
  book: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/server/http/publicRequest', () => ({ rateLimited: () => false, validCpf: () => true }));
vi.mock('@/server/scheduling/agendaRepository', () => ({
  identifyPatient: async () => ({ nome: 'Paciente fictício', professionalName: 'Profissional fictício' }),
  bookAppointments: mocks.book,
  getContatosDaSessao: async () => null,
}));
vi.mock('@/server/scheduling/agendaAvisos', () => ({ avisarSessaoMarcada: vi.fn() }));
vi.mock('@/server/payments/sessionCharge', () => ({ garantirCobrancaDaSessao: mocks.charge }));
vi.mock('@/server/payments/paymentLinkRepository', () => ({ getSessionPaymentProfile: mocks.profile }));

import { POST } from './route';

describe('confirmação do agendamento público', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.book.mockResolvedValue({ ok: true, agendamentos: [{ agendamentoId: 'a1', inicio: '2026-11-04T00:00:00.000Z', fim: '2026-11-04T00:50:00.000Z', modalidade: 'online', linkPagamento: '/pagar/sessao/teste' }] });
    mocks.charge.mockResolvedValue(undefined);
    mocks.profile.mockResolvedValue({ fundedByCompany: true, companyName: 'Empresa fictícia' });
  });

  const request = () => new Request('http://localhost/api/agenda/agendar', { method: 'POST', body: JSON.stringify({ token: 'a'.repeat(32), cpf: '12345678901', inicio: '2026-11-04T00:00:00.000Z' }) });

  it('mantém a reserva confirmada quando os dados de pagamento falham', async () => {
    mocks.profile.mockRejectedValue(new Error('indisponível'));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ success: true, pagamentoIndisponivel: true, sessoes: [{ inicio: '2026-11-04T00:00:00.000Z' }] });
    expect(mocks.book).toHaveBeenCalledOnce();
  });

  it('apresenta o custeio quando os dados estão disponíveis', async () => {
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ success: true, pagamentoIndisponivel: false, sessoes: [{ custeadoPelaEmpresa: true }] });
  });
});

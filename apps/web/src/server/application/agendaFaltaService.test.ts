import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/scheduling/agendaFalta', () => ({
  registrarFaltaDoAgendamento: vi.fn(async () => 'recorded'),
  situacaoCobrancaDaFalta: vi.fn(async () => ({ ativa: true, vencida: false })),
}));
vi.mock('@/server/scheduling/agendaRepository', () => ({ listAppointments: vi.fn(async () => []) }));
vi.mock('@/server/payments/sessionCharge', () => ({
  atualizarVencimentoCobrancaSessao: vi.fn(async () => 'updated'),
  cancelarCobrancaDaSessao: vi.fn(async () => 'cancelled'),
  garantirCobrancaDaSessao: vi.fn(async () => 'created'),
}));

import { registrarFaltaNaAgenda } from './agendaFaltaService';
import { registrarFaltaDoAgendamento, situacaoCobrancaDaFalta } from '@/server/scheduling/agendaFalta';
import { atualizarVencimentoCobrancaSessao, cancelarCobrancaDaSessao, garantirCobrancaDaSessao } from '@/server/payments/sessionCharge';
import type { RequestContext } from './context';

const context: RequestContext = {
  actor: { actorType: 'staff', userId: 'user-1', membershipId: 'member-1', membershipStatus: 'active',
    organizationId: 'org-1', professionalProfileId: 'pro-1', roles: ['professional'] },
  correlationId: 'test-correlation',
};

describe('registrarFaltaNaAgenda', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exige perfil profissional: a agenda é sempre a da sessão', async () => {
    const semPerfil = { ...context, actor: { ...context.actor, professionalProfileId: undefined } } as RequestContext;
    await expect(registrarFaltaNaAgenda(semPerfil, 'apt', { cobrar: true })).rejects.toMatchObject({ status: 403 });
    expect(registrarFaltaDoAgendamento).not.toHaveBeenCalled();
  });

  it('com cobrança, garante a do paciente e não cancela nada', async () => {
    await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: true, expectedVersion: 2 }))
      .resolves.toEqual({ appointments: [] });
    expect(registrarFaltaDoAgendamento).toHaveBeenCalledWith('org-1', 'pro-1', 'apt', { cobrar: true, expectedVersion: 2 });
    expect(garantirCobrancaDaSessao).toHaveBeenCalledWith('apt', expect.any(String));
    expect(cancelarCobrancaDaSessao).not.toHaveBeenCalled();
  });

  it('dá prazo futuro à cobrança criada depois da falta', async () => {
    await registrarFaltaNaAgenda(context, 'apt', { cobrar: true });
    const vencimento = vi.mocked(garantirCobrancaDaSessao).mock.calls[0][1]!;
    expect(Date.parse(vencimento)).toBeGreaterThan(Date.now());
  });

  it('sem cobrança, cancela a pendente e não cria outra', async () => {
    await registrarFaltaNaAgenda(context, 'apt', { cobrar: false });
    expect(cancelarCobrancaDaSessao).toHaveBeenCalledWith('apt');
    expect(garantirCobrancaDaSessao).not.toHaveBeenCalled();
  });

  it.each([
    ['not_found', 'NOT_FOUND', 404],
    ['stale', 'APPOINTMENT_CHANGED', 409],
    ['too_early', 'APPOINTMENT_NOT_STARTED', 409],
    ['invalid_status', 'INVALID_APPOINTMENT_STATUS', 409],
    ['charge_settled', 'CHARGE_SETTLED', 409],
    ['missing_amount', 'SESSION_AMOUNT_MISSING', 422],
  ] as const)('traduz %s sem tocar no financeiro', async (outcome, code, status) => {
    vi.mocked(registrarFaltaDoAgendamento).mockResolvedValueOnce(outcome);
    await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: true })).rejects.toMatchObject({ code, status });
    expect(garantirCobrancaDaSessao).not.toHaveBeenCalled();
    expect(cancelarCobrancaDaSessao).not.toHaveBeenCalled();
  });

  it.each(['failed', 'skipped'] as const)('avisa quando a cobrança terminou em %s e permite nova tentativa', async (resultado) => {
    vi.mocked(garantirCobrancaDaSessao).mockResolvedValueOnce(resultado);
    await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: true }))
      .rejects.toMatchObject({ code: 'NO_SHOW_CHARGE_FAILED', status: 502 });
    await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: true })).resolves.toEqual({ appointments: [] });
  });

  describe('cobrança que já venceu', () => {
    beforeEach(() => {
      vi.mocked(garantirCobrancaDaSessao).mockResolvedValue('existing');
      vi.mocked(situacaoCobrancaDaFalta).mockResolvedValue({ ativa: true, vencida: true });
    });

    /** A cobrança da marcação vence no horário da sessão; sem isso o link recusaria o pagamento. */
    it('renova o vencimento para o link voltar a aceitar pagamento', async () => {
      await registrarFaltaNaAgenda(context, 'apt', { cobrar: true });
      expect(atualizarVencimentoCobrancaSessao).toHaveBeenCalledWith({
        organizationId: 'org-1', professionalId: 'pro-1', appointmentId: 'apt', dueAt: expect.any(String),
      });
      const { dueAt } = vi.mocked(atualizarVencimentoCobrancaSessao).mock.calls[0][0];
      expect(Date.parse(dueAt)).toBeGreaterThan(Date.now());
    });

    it.each(['updated', 'queued', 'paid'] as const)('aceita o resultado %s', async (resultado) => {
      vi.mocked(atualizarVencimentoCobrancaSessao).mockResolvedValueOnce(resultado);
      await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: true })).resolves.toEqual({ appointments: [] });
    });

    it.each(['not_found', 'invalid'] as const)('avisa quando a renovação termina em %s', async (resultado) => {
      vi.mocked(atualizarVencimentoCobrancaSessao).mockResolvedValueOnce(resultado);
      await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: true }))
        .rejects.toMatchObject({ code: 'NO_SHOW_CHARGE_FAILED', status: 502 });
    });

    it('avisa quando a renovação lança erro, para permitir nova tentativa', async () => {
      vi.mocked(atualizarVencimentoCobrancaSessao).mockRejectedValueOnce(new Error('Pagamento em emissão.'));
      await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: true }))
        .rejects.toMatchObject({ code: 'NO_SHOW_CHARGE_FAILED', status: 502 });
    });
  });

  it('não mexe em vencimento ainda válido', async () => {
    vi.mocked(garantirCobrancaDaSessao).mockResolvedValueOnce('existing');
    vi.mocked(situacaoCobrancaDaFalta).mockResolvedValueOnce({ ativa: true, vencida: false });
    await registrarFaltaNaAgenda(context, 'apt', { cobrar: true });
    expect(atualizarVencimentoCobrancaSessao).not.toHaveBeenCalled();
  });

  it('não confirma a isenção quando o provedor já recebeu o pagamento', async () => {
    vi.mocked(cancelarCobrancaDaSessao).mockResolvedValueOnce('kept');
    vi.mocked(situacaoCobrancaDaFalta).mockResolvedValueOnce({ ativa: true, vencida: false });
    await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: false }))
      .rejects.toMatchObject({ code: 'CHARGE_SETTLED', status: 409 });
  });

  it('confirma a isenção de sessão que nunca teve cobrança', async () => {
    vi.mocked(cancelarCobrancaDaSessao).mockResolvedValueOnce('kept');
    vi.mocked(situacaoCobrancaDaFalta).mockResolvedValueOnce({ ativa: false, vencida: false });
    await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: false })).resolves.toEqual({ appointments: [] });
  });

  it('avisa quando o cancelamento da cobrança falhou', async () => {
    vi.mocked(cancelarCobrancaDaSessao).mockResolvedValueOnce('failed');
    await expect(registrarFaltaNaAgenda(context, 'apt', { cobrar: false }))
      .rejects.toMatchObject({ code: 'CHARGE_CANCELLATION_FAILED', status: 502 });
  });
});

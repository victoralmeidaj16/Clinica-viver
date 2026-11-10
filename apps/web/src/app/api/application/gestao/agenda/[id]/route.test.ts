import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => false }));
vi.mock('@/server/application/context', () => ({ resolveRequestContext: vi.fn(async () => ({ actor: { roles: ['admin'], organizationId: 'org' } })) }));
vi.mock('@/server/application/gestaoAgendaService', () => ({
  editGestaoAppointment: vi.fn(async () => ({ updated: true })),
  updateGestaoChargeDue: vi.fn(async () => ({ updated: true })),
  updateGestaoMonthlyCoverage: vi.fn(async () => ({ cobrancasPendentes: 0 })),
}));
import { editGestaoAppointment, updateGestaoChargeDue, updateGestaoMonthlyCoverage } from '@/server/application/gestaoAgendaService';
import { PATCH } from './route';
const patch = (body: Record<string, unknown>) => PATCH(new Request('http://localhost/api/application/gestao/agenda/apt', {
  method: 'PATCH', body: JSON.stringify(body),
}), { params: Promise.resolve({ id: 'apt' }) });
beforeEach(() => vi.clearAllMocks());

it('altera vencimento sem passar pela edição de horário', async () => {
  expect((await patch({ action: 'update_charge_due', dueAt: '2099-01-02T22:00:00Z' })).status).toBe(200);
  expect(updateGestaoChargeDue).toHaveBeenCalledWith(expect.anything(), 'apt', '2099-01-02T22:00:00Z');
  expect(editGestaoAppointment).not.toHaveBeenCalled();
});

it('envia somente a cota, sem aceitar paciente ou convênio indicados pelo cliente', async () => {
  expect((await patch({ action: 'update_monthly_coverage', custeioCota: 4, patientId: 'other', convenioId: 'other' })).status).toBe(200);
  expect(updateGestaoMonthlyCoverage).toHaveBeenCalledWith(expect.anything(), 'apt', 4);
  expect(editGestaoAppointment).not.toHaveBeenCalled();
});

it('recusa uma cota que não seja numérica', async () => {
  expect((await patch({ action: 'update_monthly_coverage', custeioCota: true })).status).toBe(400);
  expect(updateGestaoMonthlyCoverage).not.toHaveBeenCalled();
});

it('recusa modalidade telefone na edição', async () => {
  expect((await patch({ action: 'edit', modalidade: 'telefone' })).status).toBe(400);
  expect(editGestaoAppointment).not.toHaveBeenCalled();
});

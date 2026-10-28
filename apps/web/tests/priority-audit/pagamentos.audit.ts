import { afterAll, beforeEach, expect, it, vi } from 'vitest';
import type { RowDataPacket } from 'mysql2';
import { reconcileSessionReceivables } from '@thats-life/core';
import { fixture, org } from './fixtures';

vi.mock('server-only', () => ({}));

let f: Awaited<ReturnType<typeof fixture>>;
beforeEach(async () => {
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Rede externa proibida nesta auditoria.'); }));
  vi.stubEnv('ASAAS_WEBHOOK_TOKEN', 'audit-token');
  f = await fixture();
});
afterAll(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await f?.pool.end(); });

it('10 — notificação repetida ou fora de ordem registra o pagamento uma vez e mantém a cobrança paga', async () => {
  const paymentId = `pay-${f.charge.id}`;
  await f.financial.saveCharge({ ...f.charge, providerReference: paymentId });
  const { POST } = await import('@/app/api/financeiro/asaas/webhook/route');
  const evento = (id: string, event: string, extra: Record<string, unknown> = {}) => POST(new Request('http://audit.invalid', {
    method: 'POST', headers: { 'asaas-access-token': 'audit-token' },
    body: JSON.stringify({ id, event, payment: { id: paymentId, value: 100, billingType: 'PIX',
      paymentDate: '2026-10-28', confirmedDate: '2026-10-28', ...extra } }),
  }));

  const concorrentes = await Promise.all([
    evento(`received-${paymentId}`, 'PAYMENT_RECEIVED'),
    evento(`received-${paymentId}`, 'PAYMENT_RECEIVED'),
    evento(`confirmed-${paymentId}`, 'PAYMENT_CONFIRMED'),
    evento(`received-${paymentId}`, 'PAYMENT_RECEIVED'),
  ]);
  expect(concorrentes.map((r) => r.status)).toEqual([200, 200, 200, 200]);

  // Eventos atrasados de estados anteriores não podem reabrir a cobrança.
  for (const [id, tipo] of [[`created-${paymentId}`, 'PAYMENT_CREATED'], [`overdue-${paymentId}`, 'PAYMENT_OVERDUE'],
    [`confirmed-late-${paymentId}`, 'PAYMENT_CONFIRMED'], [`received-${paymentId}`, 'PAYMENT_RECEIVED']]) {
    expect((await evento(id, tipo)).status).toBe(200);
  }

  const ledger = await f.financial.getLedger({ organizationId: org, patientIds: [f.patient.id] });
  expect(ledger.payments).toHaveLength(1);
  expect(ledger.payments[0]).toMatchObject({ amountCents: 10000 });
  expect(reconcileSessionReceivables(ledger)[0]).toMatchObject({ paidAmountCents: 10000, outstandingAmountCents: 0 });
  const [cobranca] = await f.pool.query<RowDataPacket[]>('SELECT status FROM financeiro_cobrancas WHERE ref_core = ?', [f.charge.id]);
  expect(cobranca[0].status).toBe('paid');
});

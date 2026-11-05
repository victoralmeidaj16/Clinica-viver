import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => db, query: db.query }) }));

import { reserveAppointmentCharge } from './paymentLinkRepository';

beforeEach(() => {
  vi.clearAllMocks();
  db.rollback.mockResolvedValue(undefined);
  db.query.mockResolvedValue([[], []]);
});

/** O link continua em poder do paciente depois que o profissional isenta a falta. */
it('não reserva cobrança nova para falta sem cobrança ativa', async () => {
  expect(await reserveAppointmentCharge({ token: 'fake-token', cpf: 'fake-cpf' })).toBeNull();
  const [sql] = db.query.mock.calls[0];
  expect(sql).toContain("a.status <> 'faltou' OR EXISTS");
  expect(sql).toContain("falta_fc.status <> 'cancelled'");
  expect(db.execute).not.toHaveBeenCalled();
});

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
  // A primeira consulta pode ser a detecção da coluna do responsável financeiro.
  const sql = db.query.mock.calls.map(([texto]) => String(texto)).find((texto) => texto.includes('agendamento_ref'));
  expect(sql).toContain("a.status <> 'faltou' OR EXISTS");
  expect(sql).toContain("falta_fc.status <> 'cancelled'");
  expect(db.execute).not.toHaveBeenCalled();
});

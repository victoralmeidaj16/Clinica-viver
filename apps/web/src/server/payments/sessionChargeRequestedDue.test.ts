import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const db = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => db, query: db.query }) }));
import { reserveAppointmentCharge } from './paymentLinkRepository';
import { garantirCobrancaDaSessao } from './sessionCharge';
const requestedDue = '2099-01-09 15:00:00.000';
beforeEach(() => {
  vi.clearAllMocks();
  db.execute.mockResolvedValue([{ affectedRows: 1 }, []]);
  db.query.mockImplementation(async (sql: string) => [sql.includes('FROM clinica_agendamentos a') ? [{
    agendamento_ref: 'appointment-test', organizacao_ref: 'org-test', paciente_ref: 'patient-test', profissional_ref: 'pro-test',
    inicio: '2099-01-10 14:00:00.000', valor_centavos: 10000, paciente_nome: 'Paciente fictício', profissional_nome: 'Profissional fictício',
    cobranca_vence_em: sql.includes('a.cobranca_vence_em') ? requestedDue : undefined,
  }] : [], []]);
});
it('recupera a cobrança pelo checkout com o vencimento persistido, anterior à sessão', async () => {
  expect(await reserveAppointmentCharge({ token: 'fake-token', cpf: 'fake-cpf' }))
    .toMatchObject({ dueAt: '2099-01-09T15:00:00.000Z' });
  const insert = db.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO financeiro_cobrancas'));
  expect(insert?.[1][8]).toBe(requestedDue);
});
it('a nova tentativa de emissão sem parâmetro usa o vencimento persistido', async () => {
  expect(await garantirCobrancaDaSessao('appointment-test')).toBe('created');
  const insert = db.execute.mock.calls.find(([sql]) => sql.includes('INSERT INTO financeiro_cobrancas'));
  expect(insert?.[1][8]).toBe(requestedDue);
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  pool: { query: vi.fn(), execute: vi.fn(), getConnection: vi.fn() },
  connection: { query: vi.fn(), execute: vi.fn(), beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn() },
  get: vi.fn(), remove: vi.fn(), transaction: false,
  current: [] as Record<string, unknown>[], checkouts: [] as Record<string, unknown>[],
  job: undefined as undefined | { id: string; plano: string; vence_em: string; situacao: string },
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => mocks.pool }));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  getAsaasPayment: mocks.get, deleteAsaasPayment: mocks.remove, AsaasPaymentNotFoundError: class extends Error {},
}));
vi.mock('@/server/adapters/interPixAdapter', () => ({ getInterPixCharge: vi.fn(), cancelInterPixCharge: vi.fn() }));
vi.mock('@/server/payments/paymentLinkRepository', () => ({ reconcileSettledInterPixCharge: vi.fn() }));
import { expirarCobrancasPendentes } from './sessionCharge';
import { processAppointmentChargeDue } from './sessionChargeDueWorker';
import { AsaasPaymentNotFoundError } from '@/server/adapters/asaasAdapter';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.job = undefined; mocks.transaction = false;
  mocks.current = [{ id: 'charge-row', ref_core: 'charge-test', organizacao_ref: 'org-test', status: 'pending',
    provedor_ref: 'payment-test', vence_em: '2020-01-01 12:00:00.000', possui_pagamento: 0 }];
  mocks.checkouts = [{ id: 'checkout', cobranca_ref: 'charge-test', referencia_externa: 'VM-old',
    provedor: 'asaas', provedor_pagamento_ref: 'payment-test', status: 'pending' }];
  mocks.pool.query.mockImplementation(async (sql: string) => [sql.includes('SELECT c.ref_core') ? [{ ref_core: 'charge-test', cobranca_ref: 'charge-test',
    provedor_ref: 'payment-test', checkout_provedor: 'asaas' }] : [], []]);
  mocks.pool.getConnection.mockResolvedValue(mocks.connection);
  mocks.connection.beginTransaction.mockImplementation(async () => { mocks.transaction = true; });
  mocks.connection.commit.mockImplementation(async () => { mocks.transaction = false; });
  mocks.connection.rollback.mockImplementation(async () => { mocks.transaction = false; });
  mocks.connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT a.id')) return [[{ id: 'appointment-row' }], []];
    if (sql.includes('SELECT c.id')) return [mocks.current, []];
    if (sql.includes('SELECT x.id')) return [mocks.checkouts, []];
    if (sql.includes('GET_LOCK')) return [[{ acquired: 1 }], []];
    if (sql.includes('SELECT id, plano') || sql.includes('JSON_CONTAINS')) return [[
      ...(mocks.job?.situacao === 'pending' ? [mocks.job] : []),
    ], []];
    if (sql.includes('SELECT cobranca_ref')) return [[{ cobranca_ref: 'charge-test' }, { cobranca_ref: 'future-charge' }], []];
    return [[], []];
  });
  mocks.connection.execute.mockImplementation(async (sql: string, values: unknown[]) => {
    if (sql.includes('INSERT INTO financeiro_ajustes')) mocks.job = { id: String(values[0]), vence_em: String(values[3]), plano: String(values[4]), situacao: 'pending' };
    if (sql.includes('SET plano =')) mocks.job!.plano = String(values[0]);
    if (sql.includes('SET situacao =')) mocks.job!.situacao = String(values[0]);
    return [{ affectedRows: 1 }, []];
  });
  mocks.pool.execute.mockResolvedValue([{ affectedRows: 1 }]);
  mocks.get.mockImplementation(async () => { expect(mocks.transaction).toBe(false); return { status: 'PENDING' }; });
  mocks.remove.mockImplementation(async () => { expect(mocks.transaction).toBe(false); return true; });
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('expiração com reserva durável e revalidação', () => {
  it('mantém o trabalho pendente quando o Asaas recusa a remoção', async () => {
    mocks.remove.mockResolvedValue(false);
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 0, failed: 1 });
    expect(mocks.job?.situacao).toBe('pending');
    expect(mocks.connection.execute).not.toHaveBeenCalledWith(expect.stringContaining("SET status = 'overdue'"), expect.anything());
  });
  it('não tenta remover pagamento quando a consulta falha', async () => {
    mocks.get.mockRejectedValue(new Error('Falha simulada de consulta'));
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 0, failed: 1 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('expira após confirmar a remoção e salvar a intenção antes da rede', async () => {
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 1, paid: 0, failed: 0 });
    expect(mocks.job?.situacao).toBe('completed');
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith('payment-test');
    expect(mocks.connection.commit.mock.invocationCallOrder[0]).toBeLessThan(mocks.get.mock.invocationCallOrder[0]);
  });
  it('aceita cobrança já removida sem tentar removê-la novamente', async () => {
    mocks.get.mockRejectedValue(new AsaasPaymentNotFoundError('Removida'));
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 1, paid: 0, failed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
  });
  it('preserva pagamento confirmado no provedor', async () => {
    mocks.get.mockResolvedValue({ status: 'RECEIVED' });
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 1, failed: 0 });
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.job?.situacao).toBe('paid');
  });
  it('desfaz o grupo mesmo quando a sessão vencida não é a titular', async () => {
    mocks.checkouts[0].cobranca_ref = 'future-charge';
    mocks.current[0].provedor_ref = null;
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 1, paid: 0, failed: 0 });
    expect(mocks.connection.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM financeiro_checkout_cobrancas'),
      [expect.any(String), 'VM-old']);
    expect(mocks.connection.execute).toHaveBeenCalledWith(expect.stringContaining("SET status = 'overdue'"),
      [expect.any(String), 'org-test', 'charge-test']);
    expect(JSON.parse(mocks.job!.plano).affectedChargeIds).toEqual(['charge-test', 'future-charge']);
  });
  it('ignora a seleção antiga se o prazo já foi prorrogado antes de reservar', async () => {
    mocks.current = [];
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 0, failed: 0 });
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
    expect(mocks.connection.execute).not.toHaveBeenCalled();
    expect(mocks.connection.query).toHaveBeenCalledWith(expect.stringContaining('c.vence_em <= CURRENT_TIMESTAMP(3)'), expect.anything());
  });
  it('retoma a limpeza se o provedor cancelou mas o banco falhou depois', async () => {
    const execute = mocks.connection.execute.getMockImplementation()!;
    mocks.connection.execute.mockImplementation(async (sql, values) => {
      if (sql.includes('DELETE FROM financeiro_checkout_cobrancas')) throw new Error('Falha simulada do banco');
      return execute(sql, values);
    });
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 0, failed: 1 });
    expect(mocks.job?.situacao).toBe('pending');
    mocks.connection.execute.mockImplementation(execute);
    mocks.get.mockRejectedValue(new AsaasPaymentNotFoundError('Removida'));
    expect(await processAppointmentChargeDue('appointment-row')).toBe('updated');
    expect(mocks.job?.situacao).toBe('completed');
    expect(mocks.remove).toHaveBeenCalledTimes(1);
  });
});

it('concilia o Pix Inter já pago antes de encerrar a expiração', async () => {
  const { getInterPixCharge, cancelInterPixCharge } = await import('@/server/adapters/interPixAdapter');
  const { reconcileSettledInterPixCharge } = await import('./paymentLinkRepository');
  mocks.checkouts[0].provedor = 'inter';
  const paid = { id: 'payment-test', status: 'CONCLUIDA', value: 100, pixCopiaECola: '', pixQrCode: '',
    settlements: [{ endToEndId: 'fake-e2e', amountCents: 10000, receivedAt: '2026-10-27T12:00:00Z' }] };
  vi.mocked(getInterPixCharge).mockResolvedValue(paid);
  vi.mocked(reconcileSettledInterPixCharge).mockResolvedValue(true);
  expect(await expirarCobrancasPendentes()).toEqual({ expired: 0, paid: 1, failed: 0 });
  expect(reconcileSettledInterPixCharge).toHaveBeenCalledWith(paid);
  expect(cancelInterPixCharge).not.toHaveBeenCalled();
  expect(mocks.job?.situacao).toBe('paid');
});

const sqliteModule = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22
  ? await import(sqliteModule) as typeof import('node:sqlite') : null;
it.skipIf(!sqlite)('executa a expiração e o desagrupamento reais preservando a sessão futura e outra organização', async () => {
  const db = new sqlite!.DatabaseSync(':memory:');
  const { instituicaoId } = await import('@/server/persistence/mysql/mappers');
  const inst = instituicaoId();
  db.exec(`CREATE TABLE financeiro_cobrancas (instituicao_id TEXT, organizacao_ref TEXT, ref_core TEXT,
    status TEXT, vence_em TEXT, provedor_ref TEXT, forma_pagamento TEXT, atualizado_em TEXT);
    CREATE TABLE financeiro_pagamentos (instituicao_id TEXT, organizacao_ref TEXT, cobranca_ref TEXT, status TEXT);
    CREATE TABLE financeiro_checkout_cobrancas (instituicao_id TEXT, referencia_externa TEXT, cobranca_ref TEXT);
    CREATE TABLE financeiro_checkouts_asaas (instituicao_id TEXT, id TEXT, referencia_externa TEXT, provedor_pagamento_ref TEXT,
      provedor TEXT, status TEXT, erro_codigo TEXT, expirado_em TEXT, atualizado_em TEXT);
    CREATE TABLE financeiro_ajustes_vencimento (id TEXT, instituicao_id TEXT, agendamento_id TEXT, vence_em TEXT, plano TEXT, situacao TEXT DEFAULT 'pending');`);
  for (const [org, ref, due] of [['org-test', 'charge-test', '2020-01-01'], ['org-test', 'future-charge', '2099-01-01'], ['other-org', 'charge-test', '2020-01-01']]) {
    db.prepare("INSERT INTO financeiro_cobrancas VALUES (?, ?, ?, 'pending', ?, NULL, NULL, NULL)").run(inst, org, ref, due);
  }
  for (const ref of ['charge-test', 'future-charge']) db.prepare('INSERT INTO financeiro_checkout_cobrancas VALUES (?, ?, ?)').run(inst, 'VM-old', ref);
  db.prepare("INSERT INTO financeiro_checkouts_asaas VALUES (?, 'checkout', 'VM-old', 'payment-test', 'asaas', 'pending', NULL, NULL, NULL)").run(inst);
  mocks.checkouts[0].cobranca_ref = 'future-charge';
  const execute = mocks.connection.execute.getMockImplementation()!;
  mocks.connection.execute.mockImplementation(async (sql, values) => {
    await execute(sql, values);
    const actual = sql.replaceAll('CURRENT_TIMESTAMP(3)', 'CURRENT_TIMESTAMP').replace('UPDATE financeiro_cobrancas c', 'UPDATE financeiro_cobrancas AS c');
    const result = db.prepare(actual).run(...values as string[]);
    return [{ affectedRows: Number(result.changes) }, []];
  });
  try {
    expect(await expirarCobrancasPendentes()).toEqual({ expired: 1, paid: 0, failed: 0 });
    expect(db.prepare("SELECT status FROM financeiro_cobrancas WHERE organizacao_ref = 'org-test' AND ref_core = 'charge-test'").get()?.status).toBe('overdue');
    expect(db.prepare("SELECT status FROM financeiro_cobrancas WHERE ref_core = 'future-charge'").get()?.status).toBe('pending');
    expect(db.prepare("SELECT status FROM financeiro_cobrancas WHERE organizacao_ref = 'other-org'").get()?.status).toBe('pending');
    expect(db.prepare('SELECT COUNT(*) AS n FROM financeiro_checkout_cobrancas').get()?.n).toBe(0);
    expect(db.prepare('SELECT provedor_pagamento_ref FROM financeiro_checkouts_asaas').get()?.provedor_pagamento_ref).toBeNull();
  } finally { db.close(); }
});

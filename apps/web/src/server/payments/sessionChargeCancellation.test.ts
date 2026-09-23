import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
type Row = Record<string, unknown>;
const state = vi.hoisted(() => ({
  charges: [] as Row[], checkouts: [] as Row[],
  connection: {
    beginTransaction: vi.fn(), commit: vi.fn(), rollback: vi.fn(), release: vi.fn(),
    query: vi.fn<(sql: string) => Promise<[Row[], unknown[]]>>(),
    execute: vi.fn<(sql: string, values: unknown[]) => Promise<[{ affectedRows: number }, unknown[]]>>(async () => [{ affectedRows: 1 }, []]),
  },
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => state.connection }) }));
vi.mock('@/server/persistence/mysql/mappers', () => ({ instituicaoId: () => 'inst' }));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  AsaasPaymentNotFoundError: class extends Error {},
  getAsaasPayment: vi.fn(), deleteAsaasPayment: vi.fn(),
}));
vi.mock('@/server/adapters/interPixAdapter', () => ({ getInterPixCharge: vi.fn(), cancelInterPixCharge: vi.fn() }));
import { cancelarCobrancaDaSessao } from './sessionChargeCancellation';
import { AsaasPaymentNotFoundError, deleteAsaasPayment, getAsaasPayment } from '@/server/adapters/asaasAdapter';
import { cancelInterPixCharge, getInterPixCharge } from '@/server/adapters/interPixAdapter';

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  state.connection.rollback.mockResolvedValue(undefined);
  state.charges = [{ ref_core: 'charge', status: 'pending', possui_pagamento: 0 }];
  state.checkouts = [{ id: 'checkout', cobranca_ref: 'charge', referencia_externa: 'VM-old', status: 'pending', provedor: 'asaas', provedor_pagamento_ref: 'pay-1' }];
  state.connection.query.mockImplementation(async (sql) => [sql.includes('FROM clinica_agendamentos')
    ? [{ agendamento_ref: 'appt', organizacao_ref: 'org' }]
    : sql.includes('FROM financeiro_cobrancas c') ? state.charges
      : sql.includes('FROM financeiro_checkouts_asaas') ? state.checkouts : [], []]);
  vi.mocked(getAsaasPayment).mockResolvedValue({ id: 'pay-1', status: 'PENDING' } as Awaited<ReturnType<typeof getAsaasPayment>>);
  vi.mocked(deleteAsaasPayment).mockResolvedValue(true);
  vi.mocked(getInterPixCharge).mockResolvedValue({ id: 'tx', status: 'ATIVA', settlements: [], value: 100, pixCopiaECola: 'pix', pixQrCode: 'qr' } as Awaited<ReturnType<typeof getInterPixCharge>>);
});
afterEach(() => vi.restoreAllMocks());

const updates = () => state.connection.execute.mock.calls;

describe('cancelamento remoto da cobrança de sessão', () => {
  it('remove no Asaas antes de invalidar checkout e cobrança local', async () => {
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(deleteAsaasPayment).toHaveBeenCalledWith('pay-1');
    expect(vi.mocked(deleteAsaasPayment).mock.invocationCallOrder[0]).toBeLessThan(state.connection.execute.mock.invocationCallOrder[0]);
    expect(updates()).toHaveLength(3);
    expect(state.connection.commit).toHaveBeenCalled();
  });
  it('remove no Inter um Pix ainda ativo', async () => {
    state.checkouts[0].provedor = 'inter';
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(cancelInterPixCharge).toHaveBeenCalledWith('pay-1');
    expect(deleteAsaasPayment).not.toHaveBeenCalled();
  });
  it.each(['RECEIVED', 'CONFIRMED', 'REFUNDED'])('preserva cobrança %s no Asaas', async (status) => {
    vi.mocked(getAsaasPayment).mockResolvedValue({ status } as Awaited<ReturnType<typeof getAsaasPayment>>);
    expect(await cancelarCobrancaDaSessao('appt')).toBe('kept');
    expect(deleteAsaasPayment).not.toHaveBeenCalled();
    expect(state.connection.execute).not.toHaveBeenCalled();
  });
  it('preserva Pix liquidado antes de receber o webhook', async () => {
    state.checkouts[0].provedor = 'inter';
    vi.mocked(getInterPixCharge).mockResolvedValue({ id: 'tx', status: 'CONCLUIDA', settlements: [], value: 100, pixCopiaECola: '', pixQrCode: '' } as Awaited<ReturnType<typeof getInterPixCharge>>);
    expect(await cancelarCobrancaDaSessao('appt')).toBe('kept');
    expect(cancelInterPixCharge).not.toHaveBeenCalled();
  });
  it('preserva pagamento confirmado localmente', async () => {
    state.charges[0].possui_pagamento = 1;
    expect(await cancelarCobrancaDaSessao('appt')).toBe('kept');
    expect(getAsaasPayment).not.toHaveBeenCalled();
  });
  it('não cancela localmente nem tenta DELETE quando a consulta remota falha', async () => {
    vi.mocked(getAsaasPayment).mockRejectedValue(new Error('timeout'));
    expect(await cancelarCobrancaDaSessao('appt')).toBe('failed');
    expect(deleteAsaasPayment).not.toHaveBeenCalled();
    expect(state.connection.execute).not.toHaveBeenCalled();
    expect(state.connection.rollback).toHaveBeenCalled();
  });
  it('permite retomar após falha na remoção remota', async () => {
    vi.mocked(deleteAsaasPayment).mockRejectedValueOnce(new Error('timeout'));
    expect(await cancelarCobrancaDaSessao('appt')).toBe('failed');
    expect(state.connection.execute).not.toHaveBeenCalled();
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
  });
  it('exige confirmação de remoção do Asaas', async () => {
    vi.mocked(deleteAsaasPayment).mockResolvedValue(false);
    expect(await cancelarCobrancaDaSessao('appt')).toBe('failed');
    expect(state.connection.execute).not.toHaveBeenCalled();
  });
  it('retoma quando o Asaas já removeu a cobrança', async () => {
    vi.mocked(getAsaasPayment).mockRejectedValue(new AsaasPaymentNotFoundError());
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(deleteAsaasPayment).not.toHaveBeenCalled();
  });
  it('retoma quando o Inter já removeu a cobrança', async () => {
    state.checkouts[0].provedor = 'inter';
    vi.mocked(getInterPixCharge).mockResolvedValue({ id: 'tx', status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR', settlements: [], value: 100, pixCopiaECola: '', pixQrCode: '' } as Awaited<ReturnType<typeof getInterPixCharge>>);
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(cancelInterPixCharge).not.toHaveBeenCalled();
  });
  it('recusa cancelamento enquanto o pagamento está sendo emitido', async () => {
    state.checkouts[0].provedor_pagamento_ref = null;
    expect(await cancelarCobrancaDaSessao('appt')).toBe('failed');
    expect(state.connection.execute).not.toHaveBeenCalled();
  });
  it('cancela cobrança ainda sem provedor', async () => {
    state.checkouts = [];
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(getAsaasPayment).not.toHaveBeenCalled();
  });
  it('resolve cobrança legada sem checkout pelo provedor_ref', async () => {
    state.checkouts = [];
    state.charges[0].provedor_ref = 'legacy';
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(deleteAsaasPayment).toHaveBeenCalledWith('legacy');
  });
  it('invalida grupo e libera as outras sessões sem cancelar suas cobranças', async () => {
    state.checkouts[0].cobranca_ref = 'other-charge';
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM financeiro_checkout_cobrancas'), ['inst', 'VM-old']);
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE financeiro_checkouts_asaas'), [expect.stringMatching(/^VM-/), 'creating', 'inst', 'checkout']);
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('UPDATE financeiro_cobrancas SET'), ['inst', 'org', 'charge']);
  });
});


describe('parâmetros e confirmação da atualização local', () => {
  it('usa um parâmetro escalar por cobrança', async () => {
    state.charges.push({ ref_core: 'charge-2', status: 'pending', possui_pagamento: 0 });
    state.connection.execute.mockResolvedValue([{ affectedRows: 2 }, []]);
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(state.connection.execute).toHaveBeenCalledWith(expect.stringContaining('ref_core IN (?, ?)'), ['inst', 'org', 'charge', 'charge-2']);
  });
  it.each([0, 1])('recusa atualização incompleta de duas cobranças: %s linhas', async (affectedRows) => {
    state.charges.push({ ref_core: 'charge-2', status: 'pending', possui_pagamento: 0 });
    state.connection.execute.mockResolvedValue([{ affectedRows }, []]);
    expect(await cancelarCobrancaDaSessao('appt')).toBe('failed');
    expect(state.connection.commit).not.toHaveBeenCalled();
    expect(state.connection.rollback).toHaveBeenCalled();
  });
  it('aceita a repetição quando todas as cobranças já estão canceladas', async () => {
    state.charges[0].status = 'cancelled';
    state.checkouts = [];
    state.connection.execute.mockResolvedValue([{ affectedRows: 0 }, []]);
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
  });
});


const sqliteModuleName = 'node:sqlite';
const sqlite = Number(process.versions.node.split('.')[0]) >= 22
  ? await import(sqliteModuleName) as typeof import('node:sqlite') : null;
it.skipIf(!sqlite)('executa o UPDATE real com parâmetros preparados escalares', async () => {
  const db = new sqlite!.DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE financeiro_cobrancas (instituicao_id TEXT, organizacao_ref TEXT,
      ref_core TEXT, status TEXT, provedor_ref TEXT, atualizado_em TEXT);
      INSERT INTO financeiro_cobrancas VALUES ('inst','org','charge','pending',NULL,NULL),
        ('inst','org','charge-2','pending',NULL,NULL), ('inst','other','charge','pending',NULL,NULL);`);
    state.checkouts = [];
    state.charges.push({ ref_core: 'charge-2', status: 'pending', possui_pagamento: 0 });
    state.connection.execute.mockImplementation(async (sql, values) => {
      expect(values.every((value) => typeof value === 'string')).toBe(true);
      const result = db.prepare(sql.replaceAll('CURRENT_TIMESTAMP(3)', 'CURRENT_TIMESTAMP')).run(...values as string[]);
      return [{ affectedRows: Number(result.changes) }, []];
    });
    expect(await cancelarCobrancaDaSessao('appt')).toBe('cancelled');
    expect(db.prepare("SELECT COUNT(*) AS n FROM financeiro_cobrancas WHERE status = 'cancelled'").get()?.n).toBe(2);
    expect(db.prepare("SELECT status FROM financeiro_cobrancas WHERE organizacao_ref = 'other'").get()?.status).toBe('pending');
  } finally { db.close(); }
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { connection } = vi.hoisted(() => ({
  connection: {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(() => {}),
    query: vi.fn<(sql: string, values?: unknown[]) => Promise<[Record<string, unknown>[], unknown[]]>>(async () => [[], []]),
    execute: vi.fn<(sql: string, values?: unknown[]) => Promise<[{ affectedRows: number }, unknown[]]>>(async () => [{ affectedRows: 1 }, []]),
  },
}));

vi.mock('@/server/oci/runtime', () => ({
  getMysqlPool: () => ({ getConnection: async () => connection, query: connection.query }),
}));
vi.mock('@/server/persistence/mysql/mappers', async (original) => ({
  ...await original<typeof import('@/server/persistence/mysql/mappers')>(),
  instituicaoId: () => 'inst-1',
  rowId: (prefix: string, ref: string) => `${prefix}:${ref}`,
}));

import { registrarFaltaDoAgendamento, situacaoCobrancaDaFalta } from './agendaFalta';

const AGORA = new Date('2099-01-01T12:10:00Z');
const AGENDAMENTO = {
  id: 'apt-1', ref_core: 'apt-ref-1', status: 'agendado', versao: 3, modalidade: 'online',
  inicio: '2099-01-01T12:00:00Z', fim: '2099-01-01T12:50:00Z', sessao_clinica_ref: null,
  valor_centavos: 15000, valor_sessao_centavos: 15000, cobranca_vence_em: null,
  organizacao_ref: 'org-1', paciente_ref: 'pat-ref-1', profissional_ref: 'pro-1',
};
type Cobranca = { ref_core: string; status: string; possui_pagamento: number };

function cenario(agendamento: Record<string, unknown> = {}, cobrancas: Cobranca[] = []) {
  connection.query.mockImplementation(async (sql: string) => {
    if (sql.includes('FROM clinica_agendamentos a')) return [[{ ...AGENDAMENTO, ...agendamento }], []];
    if (sql.includes('FROM financeiro_cobrancas c')) return [cobrancas, []];
    return [[], []];
  });
}

function registrar(cobrar: boolean, expectedVersion?: number, agora = AGORA) {
  return registrarFaltaDoAgendamento('org-1', 'pro-1', 'apt-1', { cobrar, expectedVersion }, agora);
}

const escritas = () => connection.execute.mock.calls.map(([sql]) => sql);

describe('situacaoCobrancaDaFalta', () => {
  const situacao = (linhas: Record<string, unknown>[]) => {
    connection.query.mockResolvedValueOnce([linhas, []]);
    return situacaoCobrancaDaFalta('org-1', 'pro-1', 'apt-1', AGORA);
  };
  const PASSADO = '2099-01-01T12:00:00Z';
  const FUTURO = '2099-02-01T12:00:00Z';

  beforeEach(() => vi.clearAllMocks());

  it('não encontra cobrança ativa', async () => {
    expect(await situacao([])).toEqual({ ativa: false, vencida: false });
  });

  it('restringe a consulta à agenda do profissional e ignora canceladas', async () => {
    await situacao([]);
    const [sql, valores] = connection.query.mock.calls[0];
    expect(sql).toContain("c.status <> 'cancelled'");
    expect(valores).toEqual(expect.arrayContaining(['org-1', 'pro-1', 'apt-1']));
  });

  it.each([
    ['pendente vencida', { status: 'pending', vence_em: PASSADO }, true],
    ['pendente no prazo', { status: 'pending', vence_em: FUTURO }, false],
    ['já marcada como vencida', { status: 'overdue', vence_em: FUTURO }, true],
    ['paga depois do prazo', { status: 'paid', vence_em: PASSADO }, false],
    ['parcialmente paga depois do prazo', { status: 'partially_paid', vence_em: PASSADO }, false],
  ])('classifica cobrança %s', async (_nome, linha, vencida) => {
    expect(await situacao([linha])).toEqual({ ativa: true, vencida });
  });
});

describe('registrarFaltaDoAgendamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cenario();
  });

  describe('com o servidor fora de UTC', () => {
    const fusoOriginal = process.env.TZ;
    beforeEach(() => { process.env.TZ = 'America/Sao_Paulo'; });
    afterEach(() => { process.env.TZ = fusoOriginal; });

    // O pool usa `dateStrings`: o banco devolve UTC sem indicar o fuso.
    it('lê o início gravado como UTC', async () => {
      cenario({ inicio: '2099-01-01 12:05:00.000' });
      expect(await registrar(true)).toBe('recorded');
    });

    it('lê o vencimento gravado como UTC', async () => {
      cenario({ cobranca_vence_em: '2099-01-01 12:05:00.000' });
      await registrar(true);
      const update = connection.execute.mock.calls.find(([sql]) => sql.includes('UPDATE clinica_agendamentos'));
      expect(update?.[0]).toContain('cobranca_vence_em = NULL');
    });

    it('lê como UTC o vencimento da cobrança existente', async () => {
      connection.query.mockResolvedValueOnce([[{ status: 'pending', vence_em: '2099-01-01 12:05:00.000' }], []]);
      expect(await situacaoCobrancaDaFalta('org-1', 'pro-1', 'apt-1', AGORA)).toEqual({ ativa: true, vencida: true });
    });
  });

  it('recusa antes do início: o paciente ainda pode chegar', async () => {
    expect(await registrar(true, undefined, new Date('2099-01-01T11:59:00Z'))).toBe('too_early');
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });

  it('aceita depois do início, mesmo antes do término previsto', async () => {
    expect(await registrar(true)).toBe('recorded');
    expect(connection.commit).toHaveBeenCalled();
  });

  it('trava o agendamento e restringe à agenda do profissional da sessão', async () => {
    await registrar(true);
    const [sql, valores] = connection.query.mock.calls[0];
    expect(sql).toContain('FOR UPDATE');
    expect(valores).toEqual(expect.arrayContaining(['org-1', 'pro-1', 'apt-1']));
  });

  it('não encontra agendamento de outra agenda', async () => {
    connection.query.mockImplementation(async () => [[], []]);
    expect(await registrar(true)).toBe('not_found');
    expect(connection.execute).not.toHaveBeenCalled();
  });

  it.each(['realizado', 'cancelado'])('recusa sessão %s', async (status) => {
    cenario({ status });
    expect(await registrar(true)).toBe('invalid_status');
    expect(connection.execute).not.toHaveBeenCalled();
  });

  it('recusa quando outra alteração atualizou a versão', async () => {
    expect(await registrar(true, 2)).toBe('stale');
    expect(connection.execute).not.toHaveBeenCalled();
  });

  it('grava a falta, a sessão dos indicadores e tira a sessão da cota da empresa', async () => {
    await registrar(false);
    const sessao = connection.execute.mock.calls.find(([sql]) => sql.includes('clinica_sessoes'));
    expect(sessao?.[0]).toContain("'no_show'");
    const update = connection.execute.mock.calls.find(([sql]) => sql.includes('UPDATE clinica_agendamentos'));
    expect(update?.[0]).toContain("status = 'faltou'");
    expect(update?.[0]).toContain('custeado_pela_empresa = 0');
    expect(update?.[0]).toContain('versao = versao + 1');
  });

  it('não isenta sessão com pagamento confirmado: estorno é outro fluxo', async () => {
    cenario({}, [{ ref_core: 'charge-1', status: 'pending', possui_pagamento: 1 }]);
    expect(await registrar(false)).toBe('charge_settled');
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });

  it.each(['paid', 'partially_paid', 'refunded'])('não isenta cobrança %s', async (status) => {
    cenario({}, [{ ref_core: 'charge-1', status, possui_pagamento: 0 }]);
    expect(await registrar(false)).toBe('charge_settled');
  });

  it('mantém sessão paga como falta cobrada', async () => {
    cenario({}, [{ ref_core: 'charge-1', status: 'paid', possui_pagamento: 1 }]);
    expect(await registrar(true)).toBe('recorded');
  });

  it('cobrar sem cobrança nem valor configurado é recusado sem registrar', async () => {
    cenario({ valor_centavos: null, valor_sessao_centavos: null });
    expect(await registrar(true)).toBe('missing_amount');
    expect(connection.execute).not.toHaveBeenCalled();
  });

  it('completa o valor ausente para a cobrança poder nascer', async () => {
    cenario({ valor_centavos: null, valor_sessao_centavos: 12000 });
    expect(await registrar(true)).toBe('recorded');
    const update = connection.execute.mock.calls.find(([sql]) => sql.includes('UPDATE clinica_agendamentos'));
    expect(update?.[1]).toContain(12000);
  });

  it('descarta vencimento já passado para a cobrança nova não nascer vencida', async () => {
    cenario({ cobranca_vence_em: '2099-01-01T12:00:00Z' });
    await registrar(true);
    const update = connection.execute.mock.calls.find(([sql]) => sql.includes('UPDATE clinica_agendamentos'));
    expect(update?.[0]).toContain('cobranca_vence_em = NULL');
  });

  it('preserva vencimento futuro já definido', async () => {
    cenario({ cobranca_vence_em: '2099-02-01T12:00:00Z' });
    await registrar(true);
    const update = connection.execute.mock.calls.find(([sql]) => sql.includes('UPDATE clinica_agendamentos'));
    expect(update?.[0]).not.toContain('cobranca_vence_em = NULL');
  });

  it('nova tentativa sobre falta já registrada não regrava nem confere a versão antiga', async () => {
    cenario({ status: 'faltou', versao: 4, sessao_clinica_ref: 'session-apt-ref-1' });
    expect(await registrar(true, 3)).toBe('recorded');
    expect(escritas().filter((sql) => sql.includes('status ='))).toEqual([]);
    expect(connection.commit).toHaveBeenCalled();
  });

  it('nova decisão de isentar também respeita pagamento confirmado', async () => {
    cenario({ status: 'faltou', sessao_clinica_ref: 'session-apt-ref-1' },
      [{ ref_core: 'charge-1', status: 'paid', possui_pagamento: 1 }]);
    expect(await registrar(false)).toBe('charge_settled');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Linhas = Array<Record<string, unknown>>;
const banco = vi.hoisted(() => ({
  fatura: {} as Record<string, unknown>,
  cobrancas: [] as Linhas, pagamentos: [] as Linhas, estornos: [] as Linhas, eventos: [] as Linhas,
  escritas: [] as Array<{ sql: string; params: unknown[] }>,
  commit: vi.fn(async () => {}), rollback: vi.fn(async () => {}),
}));

function responder(sql: string, params: unknown[]) {
  const texto = sql.replace(/\s+/g, ' ').trim();
  if (/^(UPDATE|INSERT)/.test(texto)) { banco.escritas.push({ sql: texto, params }); return [{ affectedRows: 1 }, []]; }
  if (texto.includes('FROM financeiro_faturas_convenio')) return [[banco.fatura], []];
  if (texto.includes('FROM financeiro_webhooks_asaas')) return [banco.eventos, []];
  if (texto.includes('FROM financeiro_estornos')) return [banco.estornos, []];
  if (texto.includes('FROM financeiro_pagamentos')) return [banco.pagamentos, []];
  if (texto.includes('FROM financeiro_cobrancas')) return [banco.cobrancas, []];
  throw new Error(`Consulta não prevista no teste: ${texto.slice(0, 80)}`);
}

vi.mock('server-only', () => ({}));
vi.mock('./mappers', () => ({
  instituicaoId: () => 'inst-1', rowId: (tipo: string, ref: string) => `${tipo}:${ref}`,
  toSqlTimestamp: (valor: string) => valor, fromSqlTimestamp: (valor: unknown) => (valor ? String(valor) : null),
}));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ getConnection: async () => ({
  beginTransaction: async () => {}, commit: banco.commit, rollback: banco.rollback, release: () => {},
  query: async (sql: string, params: unknown[] = []) => responder(sql, params),
  execute: async (sql: string, params: unknown[] = []) => responder(sql, params),
}) }) }));

import { resolverRevisaoFatura } from './convenioRepository';

const escrita = (trecho: string) => banco.escritas.filter((item) => item.sql.includes(trecho));

beforeEach(() => {
  vi.clearAllMocks();
  banco.escritas = []; banco.eventos = []; banco.estornos = [];
  banco.fatura = {
    ref_core: 'fat-1', organizacao_ref: 'org-1', convenio_ref: 'conv-1', total_sessoes: 2, valor_centavos: 20_000,
    valor_recebido_divergente_centavos: null, status: 'revisao_estorno', provedor_ref: 'pay-1',
  };
  banco.cobrancas = [{ ref_core: 'c1', valor_centavos: 10_000 }, { ref_core: 'c2', valor_centavos: 10_000 }];
  banco.pagamentos = [
    { ref_core: 'pg1', cobranca_ref: 'c1', fatura_convenio_ref: 'fat-1', valor_centavos: 10_000 },
    { ref_core: 'pg2', cobranca_ref: 'c2', fatura_convenio_ref: 'fat-1', valor_centavos: 10_000 },
  ];
});

describe('pagamento com valor divergente', () => {
  beforeEach(() => {
    banco.fatura.status = 'revisao_pagamento';
    banco.fatura.valor_recebido_divergente_centavos = 18_000;
    banco.eventos = [{ processado_em: '2026-11-03T14:00:00.000Z' }];
  });

  it('aceita o valor recebido: rateia a baixa e a fatura passa a valer o que entrou', async () => {
    const resultado = await resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'aceitar_recebido');
    expect(resultado).toEqual({ id: 'fat-1', status: 'paga', valorCents: 18_000, sessoesLiberadas: 0 });
    const pagamentos = escrita('INSERT INTO financeiro_pagamentos');
    expect(pagamentos.map((item) => item.params[6])).toEqual([9_000, 9_000]);
    // A baixa leva a data do aviso do Asaas, não a do clique.
    expect(pagamentos[0].params[5]).toBe('2026-11-03T14:00:00.000Z');
    expect(escrita("SET status = 'paid'")).toHaveLength(1);
    expect(escrita("SET status = 'paga'")[0].params.slice(0, 2)).toEqual(['2026-11-03T14:00:00.000Z', 18_000]);
    expect(banco.commit).toHaveBeenCalledOnce();
  });

  it('não oferece as saídas de estorno para um pagamento em revisão', async () => {
    await expect(resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'refaturar')).rejects.toThrow('estorno em revisão');
    expect(banco.escritas).toHaveLength(0);
    expect(banco.rollback).toHaveBeenCalledOnce();
  });
});

describe('estorno', () => {
  it('estorno total com nova cobrança: libera as sessões e encerra a fatura sem apagá-la', async () => {
    banco.estornos = [{ pagamento_ref: 'pg1', estornado: 10_000 }, { pagamento_ref: 'pg2', estornado: 10_000 }];
    const resultado = await resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'refaturar');
    expect(resultado).toEqual({ id: 'fat-1', status: 'cancelada', valorCents: 20_000, sessoesLiberadas: 2 });
    const liberadas = escrita('fatura_convenio_ref = NULL');
    expect(liberadas).toHaveLength(1);
    expect(liberadas[0].sql).toContain("status = 'pending'");
    expect(liberadas[0].params.at(-1)).toEqual(['c1', 'c2']);
    expect(banco.escritas.some((item) => item.sql.startsWith('DELETE'))).toBe(false);
  });

  it('estorno parcial com nova cobrança: só a sessão estornada volta; a fatura fica paga pelo líquido', async () => {
    banco.estornos = [{ pagamento_ref: 'pg1', estornado: 10_000 }];
    const resultado = await resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'refaturar');
    expect(resultado).toEqual({ id: 'fat-1', status: 'paga', valorCents: 10_000, sessoesLiberadas: 1 });
    expect(escrita('fatura_convenio_ref = NULL')[0].params.at(-1)).toEqual(['c1']);
    expect(escrita('total_sessoes = ?')[0].params.slice(0, 3)).toEqual(['paga', 10_000, 1]);
  });

  it('encerrar não devolve nenhuma sessão para cobrança', async () => {
    banco.estornos = [{ pagamento_ref: 'pg1', estornado: 10_000 }, { pagamento_ref: 'pg2', estornado: 10_000 }];
    const resultado = await resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'encerrar');
    expect(resultado).toEqual({ id: 'fat-1', status: 'cancelada', valorCents: 20_000, sessoesLiberadas: 0 });
    expect(escrita('fatura_convenio_ref = NULL')).toHaveLength(0);
  });

  it('recusa nova cobrança quando nenhuma sessão foi estornada por inteiro', async () => {
    banco.estornos = [{ pagamento_ref: 'pg1', estornado: 4_000 }];
    await expect(resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'refaturar')).rejects.toThrow('estornada por inteiro');
    expect(banco.escritas).toHaveLength(0);
  });

  it('não aceita "valor recebido" numa fatura em revisão de estorno', async () => {
    await expect(resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'aceitar_recebido')).rejects.toThrow('pagamento em revisão');
    expect(banco.escritas).toHaveLength(0);
  });
});

it('uma segunda revisão libera apenas as sessões ainda vinculadas à fatura original', async () => {
  banco.fatura.total_sessoes = 1;
  banco.pagamentos[0].fatura_convenio_ref = 'fat-nova';
  banco.estornos = [{ pagamento_ref: 'pg1', estornado: 10_000 }, { pagamento_ref: 'pg2', estornado: 10_000 }];
  const resultado = await resolverRevisaoFatura('org-1', 'conv-1', 'fat-1', 'refaturar');
  expect(resultado.sessoesLiberadas).toBe(1);
  expect(escrita('fatura_convenio_ref = NULL')[0].params.at(-1)).toEqual(['c2']);
  expect(escrita('total_sessoes = ?')[0].params.slice(0, 3)).toEqual(['cancelada', 20_000, 0]);
});

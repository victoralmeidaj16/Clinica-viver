import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { query, connection, getConnection } = vi.hoisted(() => {
  const query = vi.fn(async () => [[], []]);
  const connection = {
    query: vi.fn(async () => [[], []]),
    execute: vi.fn(async () => [{}, []]),
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(() => {}),
  };
  return { query, connection, getConnection: vi.fn(async () => connection) };
});

vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ query, getConnection }) }));
vi.mock('./mappers', () => ({
  instituicaoId: () => 'inst-1',
  fromSqlTimestamp: (value: unknown) => String(value),
  rowId: (prefix: string, ref: string) => `${prefix}:${ref}`,
}));

import { fecharFatura, pacientesDoConvenio } from './convenioRepository';

/** Associa cada `?` do SQL ao valor que o driver vai colocar nele. */
function bindings(sql: string, values: unknown[]) {
  return sql
    .split('?')
    .slice(0, -1)
    .map((trecho, indice) => [trecho.trimEnd().split('\n').at(-1)!.trim(), values[indice]] as const);
}

describe('pacientesDoConvenio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('liga cada parâmetro ao placeholder correto quando há período', async () => {
    await pacientesDoConvenio('org-1', 'conv-1', '2026-09-01', '2026-09-07');

    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    // O recorte de período mora no LEFT JOIN, que vem antes do WHERE.
    expect(sql.indexOf('fc.emitida_em >= ?')).toBeLessThan(sql.indexOf('WHERE p.instituicao_id = ?'));
    expect(values).toEqual(['2026-09-01', '2026-09-07', 'inst-1', 'org-1', 'conv-1']);
    expect(bindings(sql, values)).toContainEqual(['WHERE p.instituicao_id =', 'inst-1']);
  });

  it('mantém a ordem dos parâmetros quando não há período', async () => {
    await pacientesDoConvenio('org-1', 'conv-1');

    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).not.toContain('fc.emitida_em >= ?');
    expect(values).toEqual(['inst-1', 'org-1', 'conv-1']);
  });
});

describe('fecharFatura', () => {
  beforeEach(() => vi.clearAllMocks());

  it('só considera cobranças efetivamente custeadas pela empresa', async () => {
    // Sem cobranças elegíveis a função aborta, mas a consulta já foi montada.
    await expect(
      fecharFatura('org-1', 'conv-1', {
        competencia: '2026-09',
        periodoInicio: '2026-09-01',
        periodoFim: '2026-09-30',
      })
    ).rejects.toThrow(/Nenhum atendimento/);

    const [sql, values] = connection.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('COALESCE(p.custeado_pela_empresa, c.empresa_paga_sessoes, 1) = 1');
    expect(sql).toContain('JOIN clinica_convenios c');
    // O filtro de custeio não carrega parâmetro: a ordem original se mantém.
    expect(values).toEqual(['inst-1', 'org-1', 'conv-1', '2026-09-01', '2026-09-30']);
    expect(connection.rollback).toHaveBeenCalled();
  });
});

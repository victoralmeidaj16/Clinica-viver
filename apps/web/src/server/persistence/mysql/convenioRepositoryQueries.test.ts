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

import {
  fecharFatura,
  listarConvenios,
  obterConvenio,
  pacientesDoConvenio,
  reconcileConvenioInvoicePayment,
  sessoesDoConvenio,
} from './convenioRepository';

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
    expect(sql.indexOf('COALESCE(s.inicio_real, s.inicio_previsto, ag.inicio, fc_base.emitida_em) >= ?'))
      .toBeLessThan(sql.indexOf('WHERE p.instituicao_id = ?'));
    expect(sql).toContain('LEFT JOIN clinica_agendamentos ag');
    expect(values).toEqual(['2026-09-01', '2026-09-07', 'inst-1', 'org-1', 'conv-1']);
    expect(bindings(sql, values)).toContainEqual(['WHERE p.instituicao_id =', 'inst-1']);
  });

  it('mantém a ordem dos parâmetros quando não há período', async () => {
    await pacientesDoConvenio('org-1', 'conv-1');

    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).not.toContain('fc_base.emitida_em) >= ?');
    expect(values).toEqual(['inst-1', 'org-1', 'conv-1']);
  });
});

describe('sessoesDoConvenio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('usa a data real ou agendada do atendimento para exibir, filtrar e ordenar', async () => {
    query.mockResolvedValueOnce([[
      {
        ref_core: 'charge-1', sessao_ref: 'session-1', paciente_ref: 'patient-1',
        profissional_ref: 'professional-1', realizada_em: '2026-09-03 14:00:00.000',
        valor_centavos: 7500, status: 'pending', fatura_convenio_ref: null,
        paciente_nome: 'Paciente', psicologo_nome: 'Psicóloga',
        custeado_pela_empresa: 1, empresa_paga_sessoes: 1,
      },
    ], []] as never);

    const resultado = await sessoesDoConvenio('org-1', 'conv-1', '2026-09-01', '2026-09-30');
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];

    expect(sql).toContain('COALESCE(s.inicio_real, s.inicio_previsto, ag.inicio, fc.emitida_em) AS realizada_em');
    expect(sql).toContain('LEFT JOIN clinica_agendamentos ag');
    expect(sql).toContain('LEFT JOIN clinica_sessoes s');
    expect(sql).toContain('COALESCE(s.inicio_real, s.inicio_previsto, ag.inicio, fc.emitida_em) >= ?');
    expect(sql).toContain('ORDER BY COALESCE(s.inicio_real, s.inicio_previsto, ag.inicio, fc.emitida_em) DESC');
    expect(values).toEqual(['inst-1', 'org-1', 'conv-1', '2026-09-01', '2026-09-30']);
    expect(resultado[0].realizadaEm).toBe('2026-09-03 14:00:00.000');
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
    // A decisão gravada na sessão vence o vínculo do paciente: sob cota, o
    // mesmo paciente tem sessões da empresa e sessões dele, e só as primeiras
    // entram no boleto.
    expect(sql).toContain('COALESCE(ag.custeado_pela_empresa,');
    expect(sql).toContain('LEFT JOIN clinica_agendamentos ag');
    expect(sql).toContain('COALESCE(p.custeado_pela_empresa, c.empresa_paga_sessoes, 1) = 0 THEN 0');
    expect(sql).toContain('< p.custeio_sessoes_cota THEN 1');
    expect(sql).toContain('JOIN clinica_convenios c');
    expect(sql).toContain('LEFT JOIN clinica_sessoes s');
    expect(sql).toContain('COALESCE(s.inicio_real, s.inicio_previsto, ag.inicio, fc.emitida_em) >= ?');
    // O filtro de custeio não carrega parâmetro: a ordem original se mantém.
    expect(values).toEqual(['inst-1', 'org-1', 'conv-1', '2026-09-01', '2026-09-30']);
    expect(connection.rollback).toHaveBeenCalled();
  });
});

describe('reconcileConvenioInvoicePayment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('registra como boleto o pagamento e as cobranças da fatura empresarial', async () => {
    connection.query
      .mockResolvedValueOnce([[{
        ref_core: 'invoice-1', organizacao_ref: 'org-1', convenio_ref: 'conv-1',
      }], []] as never)
      .mockResolvedValueOnce([[], []])
      .mockResolvedValueOnce([[{ ref_core: 'charge-1', valor_centavos: 7500 }], []] as never);

    await expect(reconcileConvenioInvoicePayment({
      eventId: 'event-1', eventType: 'PAYMENT_RECEIVED', paymentId: 'payment-1',
      amountCents: 7500, receivedAt: '2026-09-10T15:00:00.000Z',
    })).resolves.toBe('processed');

    const escritas = (
      connection.execute.mock.calls as unknown as Array<[string, unknown[]?]>
    ).map(([sql]) => sql);
    expect(escritas.some((sql) => sql.includes("'boleto', 'confirmed'"))).toBe(true);
    expect(escritas.some((sql) => sql.includes("forma_pagamento = 'boleto'"))).toBe(true);
    expect(connection.commit).toHaveBeenCalled();
  });
});


describe('cancelamentos no faturamento de convênios', () => {
  beforeEach(() => vi.clearAllMocks());

  function expectCancellationGuard(sql: string, alias: string) {
    expect(sql).toContain(`${alias}.status <> 'cancelled'`);
    expect(sql).toContain(`cancelado.instituicao_id = ${alias}.instituicao_id`);
    expect(sql).toContain(`cancelado_org.ref_core = ${alias}.organizacao_ref`);
    expect(sql).toContain(`${alias}.sessao_ref IN (cancelado.ref_core, cancelado.sessao_clinica_ref)`);
    expect(sql).toContain("cancelado.status = 'cancelado'");
    expect(sql).toContain(`cancelada.organizacao_ref = ${alias}.organizacao_ref`);
    expect(sql).toContain("cancelada.status = 'cancelled'");
    // Cancelar a agenda não apaga o histórico já faturado/recebido.
    expect(sql).toContain(`${alias}.fatura_convenio_ref IS NOT NULL`);
    expect(sql).toContain(`${alias}.status IN ('paid', 'partially_paid', 'refunded')`);
  }

  it('retira cancelamentos da lista, relatórios e totais sem remover pacientes', async () => {
    await listarConvenios('org-1');
    await obterConvenio('org-1', 'conv-1');
    await sessoesDoConvenio('org-1', 'conv-1');
    await pacientesDoConvenio('org-1', 'conv-1');
    const calls = query.mock.calls as unknown as Array<[string, unknown[]]>;
    for (const [sql] of calls.slice(0, 3)) expectCancellationGuard(sql, 'fc');
    expectCancellationGuard(calls[3][0], 'fc_base');
    expect(calls[0][0]).toContain('LEFT JOIN financeiro_cobrancas fc');
    expect(calls[3][0]).toContain('LEFT JOIN (');
  });

  it('bloqueia cobrança pendente de consulta cancelada mesmo com seleção explícita', async () => {
    await expect(fecharFatura('org-1', 'conv-1', {
      competencia: '2026-09', periodoInicio: '2026-09-01', periodoFim: '2026-09-30',
      cobrancaRefs: ['cancelled-appointment-charge'],
    })).rejects.toThrow(/Nenhum atendimento/);
    const [sql, values] = connection.query.mock.calls[0] as unknown as [string, unknown[]];
    expectCancellationGuard(sql, 'fc');
    expect(sql).toContain('fc.fatura_convenio_ref IS NULL');
    expect(sql).toContain("fc.status IN ('pending','overdue')");
    expect(values.at(-1)).toEqual(['cancelled-appointment-charge']);
    expect(connection.execute).not.toHaveBeenCalled();
    expect(connection.rollback).toHaveBeenCalled();
  });
});

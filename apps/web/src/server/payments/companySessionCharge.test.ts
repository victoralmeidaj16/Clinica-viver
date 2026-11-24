import type { PoolConnection } from 'mysql2/promise';
import { describe, expect, it, vi } from 'vitest';
import { precificarSessoesPendentes, registrarCobrancaContratual } from './companySessionCharge';

vi.mock('server-only', () => ({}));
vi.mock('@/server/persistence/mysql/mappers', () => ({
  instituicaoId: () => 'inst-1',
  rowId: (tipo: string, ref: string) => tipo + ':' + ref,
}));

const sessao = {
  agendamentoId: 'agenda-1', organizacao: 'org-1', convenio: 'empresa-1',
  sessao: 'sessao-1', paciente: 'pac-1', profissional: 'pro-1',
  inicio: new Date('2026-10-30T12:00:00Z'),
  confirmadaEm: new Date('2026-11-10T12:00:00Z'),
};

function banco() {
  const execute = vi.fn<(sql: string, values: unknown[]) => Promise<void>>();
  const query = vi.fn();
  return { execute, query, connection: { execute, query } as unknown as PoolConnection };
}

describe('cobrança contratual de sessão', () => {
  it('emite pelo valor do contrato na data da confirmação e vincula a cobrança à sessão', async () => {
    const { connection, execute } = banco();
    await registrarCobrancaContratual(connection, sessao, 10_000);

    expect(execute).toHaveBeenCalledTimes(2);
    const [insert, valores] = execute.mock.calls[0];
    expect(insert).toContain('INSERT INTO financeiro_cobrancas');
    expect(insert).toMatch(/profissional_ref, emitida_em, vence_em, valor_centavos/);
    expect(valores.slice(4, 10)).toEqual([
      sessao.sessao, sessao.paciente, sessao.profissional, sessao.confirmadaEm, sessao.confirmadaEm, 10_000,
    ]);
    expect(valores[3]).toEqual(expect.stringMatching(/^charge-company-session-/));
    expect(execute).toHaveBeenNthCalledWith(2, expect.stringContaining('UPDATE clinica_sessoes SET cobranca_ref = ?'),
      [valores[3], 'inst-1', sessao.organizacao, sessao.sessao]);
  });

  it('marca apenas a pendência quando o contrato ainda não tem preço', async () => {
    const { connection, execute } = banco();
    await registrarCobrancaContratual(connection, sessao, null);

    expect(execute).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('SET valor_contrato_pendente = 1'),
      ['inst-1', sessao.agendamentoId]);
  });

  it.each([0, -1])('recusa o valor contratual de %i centavos antes de gravar', async (valor) => {
    const { connection, execute } = banco();
    await expect(registrarCobrancaContratual(connection, sessao, valor)).rejects.toThrow('Valor contratual inválido.');
    expect(execute).not.toHaveBeenCalled();
  });

  it('precifica cada sessão pendente na confirmação original e encerra sua pendência', async () => {
    const { connection, query, execute } = banco();
    const pendentes = [1, 2].map((n) => ({
      id: 'agenda-' + n, ref_core: 'sessao-' + n, paciente_ref: 'pac-' + n,
      profissional_principal_ref: 'pro-1', inicio: new Date('2026-10-01T12:00:00Z'),
      confirmada_em: new Date(Date.UTC(2026, 9, 10 + n, 12)),
    }));
    query.mockResolvedValue([pendentes, []]);

    await precificarSessoesPendentes(connection, sessao.organizacao, sessao.convenio, 10_000);

    expect(query).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('a.valor_contrato_pendente = 1'),
      ['inst-1', sessao.organizacao, sessao.convenio]);
    const cobrancas = execute.mock.calls.filter(([sql]) => sql.includes('INSERT INTO financeiro_cobrancas'));
    expect(cobrancas.map(([, valores]) => [valores[4], valores[7], valores[9]])).toEqual(
      pendentes.map((linha) => [linha.ref_core, linha.confirmada_em, 10_000])
    );
    const baixas = execute.mock.calls.filter(([sql]) => sql.includes('SET valor_contrato_pendente = 0'));
    expect(baixas.map(([, valores]) => valores)).toEqual(pendentes.map((linha) => ['inst-1', linha.id]));
  });
});

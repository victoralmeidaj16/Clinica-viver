import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

type Linha = Record<string, unknown>;

const { connection } = vi.hoisted(() => ({
  connection: {
    beginTransaction: vi.fn(async () => {}),
    commit: vi.fn(async () => {}),
    rollback: vi.fn(async () => {}),
    release: vi.fn(() => {}),
    query: vi.fn<(sql: string, values?: unknown[]) => Promise<[Linha[], unknown[]]>>(
      async () => [[], []]
    ),
    execute: vi.fn<
      (sql: string, values?: unknown[]) => Promise<[{ affectedRows: number }, unknown[]]>
    >(async () => [{ affectedRows: 1 }, []]),
  },
}));

vi.mock('@/server/oci/runtime', () => ({
  isMysqlConfigured: () => true,
  getMysqlPool: () => ({ getConnection: async () => connection }),
}));
vi.mock('@/server/persistence/mysql/mappers', () => ({
  instituicaoId: () => 'inst-1',
  rowId: (prefix: string, ref: string) => `${prefix}:${ref}`,
  fromSqlTimestamp: (value: string) => new Date(value).toISOString(),
  toSqlTimestamp: (value: string | Date) => new Date(value).toISOString(),
}));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  deleteAsaasPayment: vi.fn(),
  getAsaasPayment: vi.fn(),
}));
vi.mock('@/server/adapters/interPixAdapter', () => ({
  cancelInterPixCharge: vi.fn(),
  getInterPixCharge: vi.fn(),
}));
vi.mock('@/server/payments/paymentLinkRepository', () => ({
  reconcileSettledInterPixCharge: vi.fn(async () => false),
}));

import { cancelarCobrancaDaSessao, garantirCobrancaDaSessao } from './sessionCharge';

/**
 * A linha do agendamento tem duas identidades: a chave física e a referência do
 * agregado. O agendamento pelo link público e a listagem da agenda entregam a
 * chave física; procurar só pela referência devolvia "não encontrei" e a
 * clínica ficava sem a cobrança — ou com a cobrança viva depois do cancelamento.
 */
const LINHA = {
  id: 'uuid-1',
  ref_core: 'agenda-link-1',
};

const PROJECAO: Linha = {
  agendamento_ref: LINHA.ref_core,
  sessao_clinica_ref: null,
  inicio: '2099-01-01T12:00:00Z',
  valor_centavos: 20000,
  organizacao_ref: 'org-1',
  paciente_ref: 'pac-1',
  profissional_ref: 'pro-1',
  custeado_pela_empresa: 0,
};

const PLACEHOLDER = /\ba\.(id|ref_core|instituicao_id)\s*=\s*\?/g;

/**
 * Duplo de banco que respeita a coluna comparada.
 *
 * Aceitar o identificador só porque ele aparece na lista de parâmetros
 * esconderia justamente o defeito: o SQL precisa comparar `a.id` para achar a
 * linha pela chave física. Os placeholders destas consultas estão todos no
 * WHERE, então casá-los em ordem com os valores reproduz a busca real.
 */
function bancoComAgendamento() {
  connection.query.mockImplementation(async (sql: string, values: unknown[] = []) => {
    if (!sql.includes('FROM clinica_agendamentos a')) return [[], []];
    const colunas = [...sql.matchAll(PLACEHOLDER)].map((match) => match[1]);
    const encontrou = colunas.some(
      (coluna, indice) =>
        coluna !== 'instituicao_id' &&
        values[indice] === LINHA[coluna as 'id' | 'ref_core']
    );
    return encontrou ? [[PROJECAO], []] : [[], []];
  });
}

describe('cobrança da sessão pelo identificador do agendamento', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cria a cobrança quando recebe a chave física da linha', async () => {
    bancoComAgendamento();

    expect(await garantirCobrancaDaSessao('uuid-1')).toBe('created');
    const insercao = connection.execute.mock.calls
      .map(([sql]) => sql)
      .find((sql) => sql.includes('INSERT INTO financeiro_cobrancas'));
    expect(insercao).toBeDefined();
  });

  it('segue criando a cobrança pela referência do agregado', async () => {
    bancoComAgendamento();

    expect(await garantirCobrancaDaSessao('agenda-link-1')).toBe('created');
  });

  it('cancela a cobrança quando recebe a chave física da linha', async () => {
    bancoComAgendamento();
    connection.execute.mockResolvedValue([{ affectedRows: 1 }, []]);

    expect(await cancelarCobrancaDaSessao('uuid-1')).toBe('cancelled');
  });

  it('não inventa cobrança para um agendamento inexistente', async () => {
    bancoComAgendamento();

    expect(await cancelarCobrancaDaSessao('desconhecido')).toBe('not_found');
  });
});

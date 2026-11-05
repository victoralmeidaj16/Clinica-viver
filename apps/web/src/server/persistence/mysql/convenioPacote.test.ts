import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const pool = vi.hoisted(() => ({ query: vi.fn(), execute: vi.fn(async () => [{ affectedRows: 1 }, []]) }));
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => pool }));

import { atualizarConvenio, criarConvenio } from './convenioRepository';

const LINHA = {
  ref_core: 'conv-1', nome: 'Convênio fictício', razao_social: null, cnpj: null, email_faturamento: null,
  empresa_paga_sessoes: 1, pacote_sessoes: 4, pacote_sessoes_ciclo: 'mensal', dia_vencimento: null, ativo: 1,
  pacientes: 0, pacientes_custeados: 0, sessoes_provisionadas: 0, valor_provisionado_centavos: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  pool.query.mockResolvedValue([[LINHA], []]);
});

const gravado = () => pool.execute.mock.calls[0] as unknown as [string, unknown[]];
const BASE = { nome: 'Convênio fictício', empresaPagaSessoes: true, ativo: true };

it('devolve o ciclo gravado no convênio', async () => {
  const convenio = await atualizarConvenio('org-1', 'conv-1', {});
  expect(convenio).toMatchObject({ pacoteSessoes: 4, pacoteSessoesCiclo: 'mensal' });
});

it('grava o ciclo informado ao criar', async () => {
  await criarConvenio('org-1', { ...BASE, pacoteSessoes: 4, pacoteSessoesCiclo: 'mensal' });
  expect(gravado()[0]).toContain('pacote_sessoes_ciclo');
  expect(gravado()[1]).toEqual(expect.arrayContaining([4, 'mensal']));
});

it('pacote sem ciclo informado conta no total', async () => {
  await criarConvenio('org-1', { ...BASE, pacoteSessoes: 10 });
  expect(gravado()[1]).toEqual(expect.arrayContaining([10, 'total']));
});

it('convênio sem pacote não guarda ciclo solto', async () => {
  await atualizarConvenio('org-1', 'conv-1', { pacoteSessoes: undefined });
  const [sql, valores] = gravado();
  expect(sql).toContain('pacote_sessoes_ciclo = ?');
  expect(valores.slice(5, 7)).toEqual([null, null]);
});

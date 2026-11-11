import { expect, it, vi } from 'vitest';

vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true }));

import { ApplicationError, failure } from './http';

it('não leva a mensagem do banco para a tela', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const erro = Object.assign(new Error("Unknown column 'fc.convenio_ref' in 'where clause'"), {
    code: 'ER_BAD_FIELD_ERROR', errno: 1054, sqlState: '42S22', sqlMessage: "Unknown column 'fc.convenio_ref'",
  });
  const resposta = failure(erro);
  expect(resposta.status).toBe(500);
  const corpo = await resposta.json();
  expect(corpo.error.code).toBe('INTERNAL_ERROR');
  expect(JSON.stringify(corpo)).not.toContain('convenio_ref');
  expect(log).toHaveBeenCalledWith('[api] Falha de infraestrutura ao atender a requisição.');
  log.mockRestore();
});

it('esconde também a falha de conexão', async () => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  const resposta = failure(Object.assign(new Error('connect ECONNREFUSED 10.0.0.5:3306'), { code: 'ECONNREFUSED', errno: -61 }));
  expect(resposta.status).toBe(500);
  expect(JSON.stringify(await resposta.json())).not.toContain('10.0.0.5');
  log.mockRestore();
});

it('continua repassando a mensagem das regras de negócio', async () => {
  const regra = failure(new Error('A seleção de atendimentos mudou. Atualize a lista e confira novamente.'));
  expect(regra.status).toBe(400);
  expect((await regra.json()).error.message).toContain('A seleção de atendimentos mudou');
  const conhecida = failure(new ApplicationError('INVALID_INVOICE_STATE', 'Esta fatura está paga.', 409));
  expect(conhecida.status).toBe(409);
});

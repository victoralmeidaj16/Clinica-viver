import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  convenio: vi.fn(), fatura: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('./clinicFinanceService', () => ({ exigirAdminFiscal: vi.fn() }));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({ obterConvenio: mocks.convenio, obterFatura: mocks.fatura }));
vi.mock('@/server/fiscal/certificadoNfse', () => ({ statusCertificadoNfse: () => ({ apto: true }), exigirCertificadoNfseApto: vi.fn() }));
vi.mock('@/server/fiscal/sefinNacional', () => ({ ambienteNfse: () => 'producao_restrita', CODIGO_TP_AMB: {}, SefinNacionalError: class extends Error {} }));
vi.mock('./nfseEmissionService', () => ({}));

import { emitirNfseFatura, previaNfseFatura } from './convenioNfseService';
import type { RequestContext } from './context';

const context = { actor: { organizationId: 'org', userId: 'admin' }, idempotencyKey: 'key' } as RequestContext;

describe('tomador da nota da fatura', () => {
  beforeEach(() => {
    mocks.convenio.mockResolvedValue({ id: 'conv', nome: 'Empresa nova', cnpj: '22222222222222', emailFaturamento: 'novo@example.test' });
    mocks.fatura.mockResolvedValue({ status: 'paga', competencia: '2026-10', valorCents: 10000, totalSessoes: 1 });
  });

  it('usa os dados preservados no boleto após editar o convênio', async () => {
    mocks.fatura.mockResolvedValue({ status: 'paga', competencia: '2026-10', valorCents: 10000, totalSessoes: 1,
      tomadorCnpj: '11111111111111', tomadorNome: 'Empresa anterior', tomadorEmail: 'anterior@example.test' });
    const preview = await previaNfseFatura(context, 'conv', 'fat');
    expect(preview.convenio).toMatchObject({ cnpj: '11111111111111', nome: 'Empresa anterior', email: 'anterior@example.test' });
    expect(preview.tomadorExigeConferencia).toBe(false);
  });

  it('bloqueia fatura antiga até que o CNPJ atual seja conferido', async () => {
    expect((await previaNfseFatura(context, 'conv', 'fat')).tomadorExigeConferencia).toBe(true);
    await expect(emitirNfseFatura(context, 'conv', 'fat', true, '11111111111111')).rejects.toMatchObject({ code: 'TOMADOR_CONFIRMATION_REQUIRED' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./clinicFinanceService', () => ({ exigirAdminFiscal: vi.fn() }));
vi.mock('@/server/reports/convenioReportPdf', () => ({ gerarRelatorioConvenioPdf: vi.fn() }));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({
  obterConvenio: vi.fn(async () => ({ id: 'conv-1' })),
  obterFatura: vi.fn(async () => ({ id: 'fat-1', status: 'boleto_gerado', providerId: 'pay-1' })),
  cancelarFatura: vi.fn(async () => {}),
}));
vi.mock('@/server/adapters/asaasAdapter', () => ({
  deleteAsaasPayment: vi.fn(async () => true),
}));

import { cancelConvenioInvoice } from './convenioService';
import { cancelarFatura, obterFatura } from '@/server/persistence/mysql/convenioRepository';
import { deleteAsaasPayment } from '@/server/adapters/asaasAdapter';
import type { RequestContext } from './context';

const context = { actor: { organizationId: 'org-1' } } as RequestContext;

/**
 * Cancelar a fatura local libera as sessões para um novo faturamento. Se o
 * boleto continuar vivo no Asaas, o mesmo atendimento seria cobrado duas
 * vezes — por isso o cancelamento local depende da confirmação do provedor.
 */
describe('cancelConvenioInvoice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(deleteAsaasPayment).mockResolvedValue(true);
  });

  it('não cancela a fatura local quando o Asaas responde com erro', async () => {
    vi.mocked(deleteAsaasPayment).mockRejectedValueOnce(
      new Error('Falha ao remover cobrança no Asaas (500).')
    );

    await expect(cancelConvenioInvoice(context, 'conv-1', 'fat-1')).rejects.toMatchObject({
      code: 'PROVIDER_CANCEL_FAILED',
      status: 502,
    });
    expect(cancelarFatura).not.toHaveBeenCalled();
  });

  it('não cancela a fatura local quando o Asaas não confirma a remoção', async () => {
    vi.mocked(deleteAsaasPayment).mockResolvedValueOnce(false);

    await expect(cancelConvenioInvoice(context, 'conv-1', 'fat-1')).rejects.toMatchObject({
      code: 'PROVIDER_CANCEL_FAILED',
    });
    expect(cancelarFatura).not.toHaveBeenCalled();
  });

  it('cancela a fatura local depois de o provedor confirmar a remoção', async () => {
    expect(await cancelConvenioInvoice(context, 'conv-1', 'fat-1')).toEqual({
      cancelled: true,
      id: 'fat-1',
    });
    expect(deleteAsaasPayment).toHaveBeenCalledWith('pay-1');
    expect(cancelarFatura).toHaveBeenCalledWith('org-1', 'conv-1', 'fat-1');
  });

  it('dispensa o provedor quando a fatura nunca gerou boleto', async () => {
    vi.mocked(obterFatura).mockResolvedValueOnce({
      id: 'fat-2',
      status: 'aberta',
    } as Awaited<ReturnType<typeof obterFatura>>);

    expect(await cancelConvenioInvoice(context, 'conv-1', 'fat-2')).toEqual({
      cancelled: true,
      id: 'fat-2',
    });
    expect(deleteAsaasPayment).not.toHaveBeenCalled();
    expect(cancelarFatura).toHaveBeenCalledWith('org-1', 'conv-1', 'fat-2');
  });
});

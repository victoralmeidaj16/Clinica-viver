import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/reports/convenioReportPdf', () => ({ gerarRelatorioConvenioPdf: vi.fn() }));
vi.mock('@/server/adapters/asaasAdapter', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: vi.fn() }));
vi.mock('@/server/payments/convenioChargeTransfer', () => ({ transferirCobrancasParaEmpresa: vi.fn() }));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({
  obterConvenio: vi.fn(async () => ({ id: 'conv-1' })),
  fecharFatura: vi.fn(async () => ({ id: 'fat-1' })),
  resolverRevisaoFatura: vi.fn(async () => ({ id: 'fat-1', status: 'paga', valorCents: 100, sessoesLiberadas: 0 })),
}));
// Só o guard real importa aqui; o restante do serviço financeiro não é usado.
vi.mock('./clinicFinanceService', async () => ({
  exigirAdminFiscal: (await vi.importActual<typeof import('./clinicFinanceService')>('./clinicFinanceService')).exigirAdminFiscal,
}));

import { closeConvenioInvoice, listConvenios, resolveConvenioInvoiceReview } from './convenioService';
import { fecharFatura, resolverRevisaoFatura } from '@/server/persistence/mysql/convenioRepository';
import type { RequestContext } from './context';

const contexto = (roles: string[]) => ({ actor: { organizationId: 'org-1', userId: 'user-1', roles }, correlationId: 'teste' }) as unknown as RequestContext;
const admin = contexto(['admin']);

beforeEach(() => vi.clearAllMocks());

describe('período do fechamento de fatura', () => {
  const base = { competencia: '2026-02', periodoInicio: '2026-02-01', periodoFim: '2026-02-28' };

  it('aceita um período com datas reais', async () => {
    await closeConvenioInvoice(admin, 'conv-1', base);
    expect(fecharFatura).toHaveBeenCalledWith('org-1', 'conv-1', expect.objectContaining(base));
  });

  /** Antes, 31 de fevereiro passava pelo formato e a tela respondia "nenhum atendimento". */
  it.each([
    ['dia que não existe', { periodoFim: '2026-02-31' }],
    ['mês que não existe', { periodoInicio: '2026-13-01' }],
    ['competência com mês inválido', { competencia: '2026-00' }],
    ['fim antes do início', { periodoInicio: '2026-02-20', periodoFim: '2026-02-10' }],
  ])('recusa %s sem consultar o banco', async (_caso, ajuste) => {
    await expect(closeConvenioInvoice(admin, 'conv-1', { ...base, ...ajuste })).rejects.toMatchObject({ code: 'INVALID_INPUT', status: 400 });
    expect(fecharFatura).not.toHaveBeenCalled();
  });
});

describe('saída da revisão de fatura', () => {
  it('exige uma ação conhecida e a confirmação antes de mexer na fatura', async () => {
    await expect(resolveConvenioInvoiceReview(admin, 'conv-1', 'fat-1', { acao: 'apagar', confirmar: true })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    await expect(resolveConvenioInvoiceReview(admin, 'conv-1', 'fat-1', { acao: 'refaturar' })).rejects.toMatchObject({ code: 'CONFIRMATION_REQUIRED' });
    expect(resolverRevisaoFatura).not.toHaveBeenCalled();
  });

  it('repassa a decisão confirmada pela gestão', async () => {
    await resolveConvenioInvoiceReview(admin, 'conv-1', 'fat-1', { acao: 'aceitar_recebido', confirmar: true });
    expect(resolverRevisaoFatura).toHaveBeenCalledWith('org-1', 'conv-1', 'fat-1', 'aceitar_recebido');
  });

  it('recusa quem não é da gestão', async () => {
    await expect(resolveConvenioInvoiceReview(contexto(['professional']), 'conv-1', 'fat-1', { acao: 'encerrar', confirmar: true })).rejects.toMatchObject({ status: 403 });
    expect(resolverRevisaoFatura).not.toHaveBeenCalled();
  });
});

it('fala de convênios, e não de NFS-e, ao recusar quem não é administrador', async () => {
  await expect(listConvenios(contexto(['professional']))).rejects.toMatchObject({
    status: 403, message: 'A gestão de convênios é exclusiva do perfil administrador.',
  });
});

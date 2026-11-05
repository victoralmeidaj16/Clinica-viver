import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./clinicFinanceService', () => ({ exigirAdminFiscal: vi.fn() }));
vi.mock('@/server/reports/convenioReportPdf', () => ({ gerarRelatorioConvenioPdf: vi.fn() }));
vi.mock('@/server/adapters/asaasAdapter', () => ({}));
vi.mock('@/server/payments/convenioChargeTransfer', () => ({ transferirCobrancasParaEmpresa: vi.fn() }));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({
  atualizarConvenio: vi.fn(),
  obterConvenio: vi.fn(),
  pacientesDoConvenio: vi.fn(async () => [
    { id: 'pat-empresa', custeadoPelaEmpresa: true },
    { id: 'pat-proprio', custeadoPelaEmpresa: false },
  ]),
}));

import { updateConvenio } from './convenioService';
import { atualizarConvenio, obterConvenio } from '@/server/persistence/mysql/convenioRepository';
import { transferirCobrancasParaEmpresa } from '@/server/payments/convenioChargeTransfer';
import type { RequestContext } from './context';

const context = { actor: { organizationId: 'org-1' } } as RequestContext;
const CONVENIO = { id: 'conv-1', nome: 'Convênio fictício', empresaPagaSessoes: true, pacoteSessoes: 4, pacoteSessoesCiclo: 'total' };

function acordo(antes: Partial<typeof CONVENIO>, depois: Partial<typeof CONVENIO>) {
  vi.mocked(obterConvenio).mockResolvedValueOnce({ ...CONVENIO, ...antes } as never);
  vi.mocked(atualizarConvenio).mockResolvedValueOnce({ ...CONVENIO, ...depois } as never);
}

beforeEach(() => vi.clearAllMocks());

/** O formulário sempre reenvia o acordo inteiro; corrigir um e-mail não pode mover cobrança de paciente. */
it('não move cobranças numa edição que não altera o acordo', async () => {
  acordo({}, {});
  await updateConvenio(context, 'conv-1', { emailFaturamento: 'financeiro@example.com', empresaPagaSessoes: true, pacoteSessoes: 4 });
  expect(transferirCobrancasParaEmpresa).not.toHaveBeenCalled();
});

it('move as cobranças dos pacientes cobertos quando a empresa passa a pagar', async () => {
  acordo({ empresaPagaSessoes: false }, {});
  await updateConvenio(context, 'conv-1', { empresaPagaSessoes: true });
  expect(transferirCobrancasParaEmpresa).toHaveBeenCalledOnce();
  expect(transferirCobrancasParaEmpresa).toHaveBeenCalledWith('org-1', 'pat-empresa');
});

it('move as cobranças quando o pacote aumenta', async () => {
  acordo({}, { pacoteSessoes: 8 });
  await updateConvenio(context, 'conv-1', { empresaPagaSessoes: true, pacoteSessoes: 8 });
  expect(transferirCobrancasParaEmpresa).toHaveBeenCalledWith('org-1', 'pat-empresa');
});

it('não move cobranças quando o pacote diminui', async () => {
  acordo({}, { pacoteSessoes: 2 });
  await updateConvenio(context, 'conv-1', { empresaPagaSessoes: true, pacoteSessoes: 2 });
  expect(transferirCobrancasParaEmpresa).not.toHaveBeenCalled();
});

it('devolve não encontrado sem mover nada', async () => {
  vi.mocked(obterConvenio).mockResolvedValueOnce(null);
  vi.mocked(atualizarConvenio).mockResolvedValueOnce(null);
  await expect(updateConvenio(context, 'outro', { empresaPagaSessoes: true })).rejects.toMatchObject({ status: 404 });
  expect(transferirCobrancasParaEmpresa).not.toHaveBeenCalled();
});

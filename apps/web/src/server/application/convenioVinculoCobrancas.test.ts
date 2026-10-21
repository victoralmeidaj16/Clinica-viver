import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./clinicFinanceService', () => ({ exigirAdminFiscal: vi.fn() }));
vi.mock('@/server/reports/convenioReportPdf', () => ({ gerarRelatorioConvenioPdf: vi.fn() }));
vi.mock('@/server/adapters/asaasAdapter', () => ({}));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({
  vincularPacienteConvenio: vi.fn(async () => {}),
}));
vi.mock('@/server/payments/convenioChargeTransfer', () => ({
  transferirCobrancasParaEmpresa: vi.fn(async () => ({ transferidas: 2, mantidas: 0 })),
}));

import { updatePatientConvenio } from './convenioService';
import { vincularPacienteConvenio } from '@/server/persistence/mysql/convenioRepository';
import { transferirCobrancasParaEmpresa } from '@/server/payments/convenioChargeTransfer';
import type { RequestContext } from './context';

const context = { actor: { organizationId: 'org-1' } } as RequestContext;

/**
 * Vincular depois de agendar deixava as sessões já marcadas com a cobrança
 * individual, fora do que a empresa tem a faturar.
 */
describe('updatePatientConvenio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('revê as cobranças já emitidas depois de gravar o vínculo', async () => {
    const resultado = await updatePatientConvenio(context, 'pac-1', { convenioId: 'conv-1' });

    expect(vincularPacienteConvenio).toHaveBeenCalledBefore(vi.mocked(transferirCobrancasParaEmpresa));
    expect(transferirCobrancasParaEmpresa).toHaveBeenCalledWith('org-1', 'pac-1');
    expect(resultado.cobrancasTransferidas).toBe(2);
  });

  it('não mexe em cobranças ao desvincular', async () => {
    const resultado = await updatePatientConvenio(context, 'pac-1', { convenioId: '' });

    expect(transferirCobrancasParaEmpresa).not.toHaveBeenCalled();
    expect(resultado.cobrancasTransferidas).toBe(0);
  });
});

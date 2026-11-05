import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/reports/convenioReportPdf', () => ({ gerarRelatorioConvenioPdf: vi.fn() }));
vi.mock('@/server/adapters/asaasAdapter', () => ({}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => true, getMysqlPool: vi.fn() }));
vi.mock('@/server/payments/convenioChargeTransfer', () => ({
  transferirCobrancasParaEmpresa: vi.fn(async () => ({ transferidas: 0, mantidas: 0 })),
}));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({
  listarConvenios: vi.fn(async () => []),
  criarConvenio: vi.fn(async () => ({ id: 'conv-1' })),
  vincularPacienteConvenio: vi.fn(async () => {}),
}));
// Só o guard real importa aqui; o restante do serviço financeiro não é usado.
vi.mock('./clinicFinanceService', async () => ({
  exigirAdminFiscal: (await vi.importActual<typeof import('./clinicFinanceService')>('./clinicFinanceService')).exigirAdminFiscal,
}));

import { createConvenio, listConvenios, updatePatientConvenio } from './convenioService';
import { criarConvenio, listarConvenios, vincularPacienteConvenio } from '@/server/persistence/mysql/convenioRepository';
import type { RequestContext } from './context';

function contextWith(roles: string[]): RequestContext {
  return {
    actor: {
      actorType: 'staff', membershipStatus: 'active', membershipId: 'member-1',
      organizationId: 'org-test', userId: 'user-test', roles, professionalProfileId: 'professional-1',
    },
    correlationId: 'correlation-test',
  } as RequestContext;
}

describe('permissões de convênio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('recusa psicólogo antes de consultar, criar ou vincular convênios', async () => {
    const psicologo = contextWith(['professional']);
    await expect(listConvenios(psicologo)).rejects.toMatchObject({ status: 403 });
    await expect(createConvenio(psicologo, { nome: 'Convênio Fictício' })).rejects.toMatchObject({ status: 403 });
    await expect(updatePatientConvenio(psicologo, 'pac-1', { convenioId: 'conv-1' })).rejects.toMatchObject({ status: 403 });
    expect(listarConvenios).not.toHaveBeenCalled();
    expect(criarConvenio).not.toHaveBeenCalled();
    expect(vincularPacienteConvenio).not.toHaveBeenCalled();
  });

  it('permite à administração vincular paciente ao convênio', async () => {
    await updatePatientConvenio(contextWith(['admin']), 'pac-1', { convenioId: 'conv-1' });
    expect(vincularPacienteConvenio).toHaveBeenCalledOnce();
  });
});

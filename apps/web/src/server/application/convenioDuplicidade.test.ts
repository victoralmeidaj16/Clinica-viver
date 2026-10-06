import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('./clinicFinanceService', () => ({ exigirAdminFiscal: vi.fn() }));
vi.mock('@/server/reports/convenioReportPdf', () => ({ gerarRelatorioConvenioPdf: vi.fn() }));
vi.mock('@/server/adapters/asaasAdapter', () => ({}));
vi.mock('@/server/persistence/mysql/convenioRepository', () => ({
  criarConvenio: vi.fn(),
  atualizarConvenio: vi.fn(),
}));

import { createConvenio, updateConvenio } from './convenioService';
import { atualizarConvenio, criarConvenio } from '@/server/persistence/mysql/convenioRepository';
import type { RequestContext } from './context';

const context = { actor: { organizationId: 'org-viver-mais' } } as RequestContext;
const duplicateNameError = Object.assign(
  new Error(
    "Duplicate entry 'instituicao-org-viver-mais-CANGURU EMBALAGENS' " +
    "for key 'clinica_convenios.clinica_convenios_nome_uq'"
  ),
  { code: 'ER_DUP_ENTRY' }
);

describe('unicidade do nome de convênio', () => {
  beforeEach(() => vi.clearAllMocks());

  it('retorna conflito legível ao tentar criar um nome existente', async () => {
    vi.mocked(criarConvenio).mockRejectedValueOnce(duplicateNameError);

    await expect(createConvenio(context, { nome: 'CANGURU EMBALAGENS' })).rejects.toMatchObject({
      code: 'CONVENIO_NAME_CONFLICT',
      status: 409,
      message: 'Já existe um convênio com este nome. Localize-o na lista para editar o cadastro existente.',
    });
  });

  it('retorna o mesmo conflito ao renomear para um nome existente', async () => {
    vi.mocked(atualizarConvenio).mockRejectedValueOnce(duplicateNameError);

    await expect(updateConvenio(context, 'convenio-1', { nome: 'CANGURU EMBALAGENS' })).rejects.toMatchObject({
      code: 'CONVENIO_NAME_CONFLICT',
      status: 409,
    });
  });

  it('não mascara outros erros de persistência', async () => {
    const databaseError = Object.assign(new Error('Connection lost'), { code: 'PROTOCOL_CONNECTION_LOST' });
    vi.mocked(criarConvenio).mockRejectedValueOnce(databaseError);

    await expect(createConvenio(context, { nome: 'Outro convênio' })).rejects.toBe(databaseError);
  });
});

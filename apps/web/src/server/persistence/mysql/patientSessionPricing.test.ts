import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const execute = vi.fn();
vi.mock('@/server/oci/runtime', () => ({ getMysqlPool: () => ({ execute }) }));
vi.mock('./mappers', () => ({ instituicaoId: () => 'inst' }));

import {
  patientSessionPricingFromRow,
  updatePatientSessionPricing,
  validatePatientSessionPricing,
} from './patientSessionPricing';

describe('configuração financeira individual do paciente', () => {
  it('exige centavos positivos e inteiros para Personalizado', () => {
    expect(validatePatientSessionPricing({ category: 'personalizado', customAmountCents: 7500 }))
      .toEqual({ category: 'personalizado', customAmountCents: 7500 });
    for (const customAmountCents of [undefined, 0, -1, 75.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => validatePatientSessionPricing({ category: 'personalizado', customAmountCents })).toThrow('valor personalizado');
    }
  });

  it('limpa valor próprio para as categorias padrão e rejeita categoria desconhecida', () => {
    expect(validatePatientSessionPricing({ category: 'acessivel', customAmountCents: 7500 }))
      .toEqual({ category: 'acessivel', customAmountCents: null });
    expect(validatePatientSessionPricing({ category: 'particular', customAmountCents: 7500 }))
      .toEqual({ category: 'particular', customAmountCents: null });
    expect(() => validatePatientSessionPricing({ category: 'convenio' })).toThrow('categoria');
  });

  it('lê estado legado e ignora valor personalizado inválido persistido', () => {
    expect(patientSessionPricingFromRow({})).toEqual({ category: null, customAmountCents: null });
    expect(patientSessionPricingFromRow({ categoria_valor_sessao: 'personalizado', valor_sessao_personalizado_centavos: 0 }))
      .toEqual({ category: 'personalizado', customAmountCents: null });
  });

  it('atualiza somente o paciente da organização e devolve 404 se não o encontrar', async () => {
    execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
    await updatePatientSessionPricing('org', 'patient', { category: 'personalizado', customAmountCents: 7500 });
    expect(execute).toHaveBeenCalledWith(expect.stringContaining('o.ref_core = ?'), ['personalizado', 7500, 'inst', 'org', 'patient']);
    execute.mockResolvedValueOnce([{ affectedRows: 0 }]);
    await expect(updatePatientSessionPricing('other-org', 'patient', { category: 'particular', customAmountCents: null }))
      .rejects.toThrow('Paciente não encontrado');
  });
});

import { writeFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { VERSAO_TERMO_ADESAO } from '@/components/forms/termoAdesaoContent';
import type { CadastroPsicologoRecord } from './persistence';
import { codigoVerificacaoAceite, sha256 } from './termoAdesaoComprovante';
import { gerarComprovanteTermoAdesaoPdf } from './termoAdesaoComprovantePdf';

const cadastro = {
  id: 'psi-cad-teste',
  nomeCompleto: 'Profissional de teste',
  crp: '00/00000',
  whatsapp: '',
  email: 'profissional@example.com',
  status: 'EM_ANALISE',
  criadoEm: '2026-10-15T17:32:10.000Z',
  aceiteTermoAdesao: {
    versao: VERSAO_TERMO_ADESAO,
    aceitoEm: '2026-10-15T17:32:10.000Z',
    ip: '203.0.113.7',
    navegador: 'Mozilla/5.0 (teste)',
    hashAlgoritmo: 'SHA-256',
    hashTexto: 'a'.repeat(64),
  },
} as CadastroPsicologoRecord;

describe('comprovante do aceite do Termo de Adesão', () => {
  it('gera o mesmo PDF, byte a byte, para o mesmo cadastro', async () => {
    const primeiro = await gerarComprovanteTermoAdesaoPdf(cadastro);
    const segundo = await gerarComprovanteTermoAdesaoPdf(cadastro);
    expect(primeiro.subarray(0, 5).toString()).toBe('%PDF-');
    expect(sha256(primeiro)).toBe(sha256(segundo));
    if (process.env.SALVAR_COMPROVANTE) writeFileSync(process.env.SALVAR_COMPROVANTE, primeiro);
  });

  it('muda o código de verificação quando qualquer dado da prova muda', () => {
    const original = codigoVerificacaoAceite(cadastro);
    expect(original).toMatch(/^[0-9a-f]{64}$/);
    expect(codigoVerificacaoAceite({ ...cadastro, crp: '00/00001' })).not.toBe(original);
    expect(codigoVerificacaoAceite({
      ...cadastro,
      aceiteTermoAdesao: { ...cadastro.aceiteTermoAdesao!, ip: '198.51.100.1' },
    })).not.toBe(original);
  });

  it('não gera comprovante sem prova de aceite', async () => {
    await expect(gerarComprovanteTermoAdesaoPdf({ ...cadastro, aceiteTermoAdesao: undefined }))
      .rejects.toThrow('sem prova de aceite');
  });
});

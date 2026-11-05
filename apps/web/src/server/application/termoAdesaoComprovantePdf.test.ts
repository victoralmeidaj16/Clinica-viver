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
    expect(primeiro.toString('latin1').match(/\/Type \/Page\b/g)).toHaveLength(5);
    if (process.env.SALVAR_COMPROVANTE) writeFileSync(process.env.SALVAR_COMPROVANTE, primeiro);
  });

  it('reproduz o comprovante anterior sem alterar seu PDF nem os hashes registrados', async () => {
    const pdf = await gerarComprovanteTermoAdesaoPdf({ ...cadastro,
      aceiteTermoAdesao: { ...cadastro.aceiteTermoAdesao!, versao: '2026.2' },
    });
    // O renderizador original produz estes hashes nas versões de zlib usadas
    // pelos runtimes locais; a compressão muda sem alterar o documento.
    expect([
      '026bc94e85d2c6217cf51aea842dd4534ea87ca7dabf4fde0179d09cec11553f',
      '269a540ebc9dfbeb51ed2b256263d35c96c64d304d2738875c72266655c0d235',
    ]).toContain(sha256(pdf));
  });

  it('não substitui uma versão desconhecida pelo texto atual', async () => {
    await expect(gerarComprovanteTermoAdesaoPdf({ ...cadastro,
      aceiteTermoAdesao: { ...cadastro.aceiteTermoAdesao!, versao: 'desconhecida' },
    })).rejects.toThrow('Versão do Termo de Adesão indisponível.');
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

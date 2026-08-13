import { describe, expect, it } from 'vitest';
import {
  avaliarCertificado,
  extrairCnpjDoTitular,
  formatarCnpj,
  normalizarCnpj,
  type DadosCertificado,
} from './certificadoIcpBrasil';

const CNPJ_VIVER_MAIS = '19440737000153';

/**
 * O titular e as datas abaixo são os do certificado A1 real da clínica, lidos
 * do próprio arquivo. Nenhuma chave, nenhuma senha: só o que já está impresso
 * na parte pública do certificado, que é o que a regra precisa julgar.
 */
const certificadoDaClinica: DadosCertificado = {
  titular: 'VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS E CIA LTDA:19440737000153',
  validoDe: '2026-03-16T18:22:13.000Z',
  validoAte: '2027-03-16T18:22:13.000Z',
  emissor: 'AC SyngularID Multipla',
};

describe('normalizarCnpj / formatarCnpj', () => {
  it('ignora a pontuação ao comparar', () => {
    expect(normalizarCnpj('19.440.737/0001-53')).toBe(CNPJ_VIVER_MAIS);
    expect(normalizarCnpj(undefined)).toBe('');
  });

  it('formata para leitura humana', () => {
    expect(formatarCnpj(CNPJ_VIVER_MAIS)).toBe('19.440.737/0001-53');
  });
});

describe('extrairCnpjDoTitular', () => {
  it('lê o CNPJ depois do dois-pontos do CN da ICP-Brasil', () => {
    expect(extrairCnpjDoTitular(certificadoDaClinica.titular)).toBe(CNPJ_VIVER_MAIS);
  });

  it('devolve nulo quando o CN não traz CNPJ', () => {
    expect(extrairCnpjDoTitular('FULANO DE TAL')).toBeNull();
    expect(extrairCnpjDoTitular('EMPRESA:123')).toBeNull();
  });
});

describe('avaliarCertificado', () => {
  it('aprova o certificado da clínica dentro da vigência', () => {
    const avaliacao = avaliarCertificado(certificadoDaClinica, {
      cnpjPrestador: '19.440.737/0001-53',
      agora: '2026-08-13T12:00:00.000Z',
    });

    expect(avaliacao.apto).toBe(true);
    expect(avaliacao.impedimentos).toEqual([]);
    expect(avaliacao.cnpjTitular).toBe(CNPJ_VIVER_MAIS);
    expect(avaliacao.diasParaVencer).toBeGreaterThan(200);
  });

  it('impede a emissão depois do vencimento', () => {
    const avaliacao = avaliarCertificado(certificadoDaClinica, {
      cnpjPrestador: CNPJ_VIVER_MAIS,
      agora: '2027-03-17T00:00:00.000Z',
    });

    expect(avaliacao.apto).toBe(false);
    expect(avaliacao.impedimentos.join(' ')).toContain('venceu');
  });

  it('impede a emissão antes do início da vigência', () => {
    const avaliacao = avaliarCertificado(certificadoDaClinica, {
      cnpjPrestador: CNPJ_VIVER_MAIS,
      agora: '2026-01-10T00:00:00.000Z',
    });

    expect(avaliacao.apto).toBe(false);
    expect(avaliacao.impedimentos.join(' ')).toContain('passa a valer');
  });

  // O caso que motivou a checagem: havia dois CNPJs diferentes no código, e o
  // errado assinaria nota em nome de uma empresa que não prestou o serviço.
  it('impede a emissão quando o certificado é de outro CNPJ', () => {
    const avaliacao = avaliarCertificado(certificadoDaClinica, {
      cnpjPrestador: '48.912.830/0001-12',
      agora: '2026-08-13T12:00:00.000Z',
    });

    expect(avaliacao.apto).toBe(false);
    expect(avaliacao.impedimentos.join(' ')).toContain('19.440.737/0001-53');
    expect(avaliacao.impedimentos.join(' ')).toContain('48.912.830/0001-12');
  });

  it('avisa antes de vencer, sem bloquear', () => {
    const avaliacao = avaliarCertificado(certificadoDaClinica, {
      cnpjPrestador: CNPJ_VIVER_MAIS,
      agora: '2027-03-01T18:22:13.000Z',
    });

    expect(avaliacao.apto).toBe(true);
    expect(avaliacao.diasParaVencer).toBe(15);
    expect(avaliacao.alertas.join(' ')).toContain('vence em 15');
  });

  it('não aprova quando as datas do certificado são ilegíveis', () => {
    const avaliacao = avaliarCertificado(
      { ...certificadoDaClinica, validoAte: 'não é data' },
      { cnpjPrestador: CNPJ_VIVER_MAIS, agora: '2026-08-13T12:00:00.000Z' }
    );

    expect(avaliacao.apto).toBe(false);
  });
});

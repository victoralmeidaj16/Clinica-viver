import { describe, expect, it } from 'vitest';
import {
  comporIdentificadorDps,
  decomporIdentificadorDps,
  TAMANHO_IDENTIFICADOR_DPS,
} from './identificadorDps';

// Tubarão/SC, confirmado na API de localidades do IBGE.
const TUBARAO = '4218707';
const CNPJ_VIVER_MAIS = '19440737000153';

describe('comporIdentificadorDps', () => {
  it('monta os 42 dígitos na ordem do manual', () => {
    const id = comporIdentificadorDps({
      codigoMunicipioIbge: TUBARAO,
      tipoInscricao: 'CNPJ',
      inscricaoFederal: CNPJ_VIVER_MAIS,
      serie: 1,
      numero: 1,
    });

    expect(id).toHaveLength(TAMANHO_IDENTIFICADOR_DPS);
    expect(id).toBe('4218707' + '2' + '19440737000153' + '00001' + '000000000000001');
  });

  it('aceita CNPJ pontuado, porque é assim que ele chega das telas', () => {
    const pontuado = comporIdentificadorDps({
      codigoMunicipioIbge: TUBARAO,
      tipoInscricao: 'CNPJ',
      inscricaoFederal: '19.440.737/0001-53',
      serie: 1,
      numero: 42,
    });
    const limpo = comporIdentificadorDps({
      codigoMunicipioIbge: TUBARAO,
      tipoInscricao: 'CNPJ',
      inscricaoFederal: CNPJ_VIVER_MAIS,
      serie: 1,
      numero: 42,
    });

    expect(pontuado).toBe(limpo);
  });

  it('completa o CPF com zeros à esquerda no campo de 14', () => {
    const id = comporIdentificadorDps({
      codigoMunicipioIbge: TUBARAO,
      tipoInscricao: 'CPF',
      inscricaoFederal: '12345678901',
      serie: 1,
      numero: 7,
    });

    expect(id.slice(8, 22)).toBe('00012345678901');
    expect(id).toHaveLength(TAMANHO_IDENTIFICADOR_DPS);
  });

  it('recusa município fora do formato IBGE', () => {
    expect(() =>
      comporIdentificadorDps({
        codigoMunicipioIbge: '421870',
        tipoInscricao: 'CNPJ',
        inscricaoFederal: CNPJ_VIVER_MAIS,
        serie: 1,
        numero: 1,
      })
    ).toThrow(/7 dígitos/);
  });

  it('recusa inscrição federal com largura errada', () => {
    expect(() =>
      comporIdentificadorDps({
        codigoMunicipioIbge: TUBARAO,
        tipoInscricao: 'CNPJ',
        inscricaoFederal: '1944073700015',
        serie: 1,
        numero: 1,
      })
    ).toThrow(/14 dígitos/);
  });

  // Numeração é o que a Sefin usa para detectar duplicidade: número zero, ou
  // ausente, viraria uma rejeição no envio em vez de um erro aqui.
  it('recusa número zerado', () => {
    expect(() =>
      comporIdentificadorDps({
        codigoMunicipioIbge: TUBARAO,
        tipoInscricao: 'CNPJ',
        inscricaoFederal: CNPJ_VIVER_MAIS,
        serie: 1,
        numero: 0,
      })
    ).toThrow(/maior que zero/);
  });

  it('recusa número que não cabe no campo', () => {
    expect(() =>
      comporIdentificadorDps({
        codigoMunicipioIbge: TUBARAO,
        tipoInscricao: 'CNPJ',
        inscricaoFederal: CNPJ_VIVER_MAIS,
        serie: 1,
        numero: '1234567890123456',
      })
    ).toThrow(/excede 15/);
  });
});

describe('decomporIdentificadorDps', () => {
  it('devolve os campos originais (ida e volta)', () => {
    const composicao = {
      codigoMunicipioIbge: TUBARAO,
      tipoInscricao: 'CNPJ' as const,
      inscricaoFederal: CNPJ_VIVER_MAIS,
      serie: 1,
      numero: 128,
    };

    expect(decomporIdentificadorDps(comporIdentificadorDps(composicao))).toEqual({
      codigoMunicipioIbge: TUBARAO,
      tipoInscricao: 'CNPJ',
      inscricaoFederal: CNPJ_VIVER_MAIS,
      serie: '00001',
      numero: '000000000000128',
    });
  });

  it('remove o preenchimento do CPF na volta', () => {
    const id = comporIdentificadorDps({
      codigoMunicipioIbge: TUBARAO,
      tipoInscricao: 'CPF',
      inscricaoFederal: '12345678901',
      serie: 2,
      numero: 3,
    });

    expect(decomporIdentificadorDps(id).inscricaoFederal).toBe('12345678901');
  });

  it('recusa identificador de tamanho errado', () => {
    expect(() => decomporIdentificadorDps('4218707219440737000153')).toThrow(/42 dígitos/);
  });
});

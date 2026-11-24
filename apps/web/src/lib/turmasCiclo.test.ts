import { describe, expect, it } from 'vitest';
import {
  AVISOS_TURMA_PADRAO,
  dataDeSaida,
  dataValida,
  lerAvisosTurma,
  lerPrazoSaida,
  marcoDoAviso,
  normalizarCodigoTurma,
  PRAZO_SAIDA_PADRAO,
  rotuloRestante,
  situacaoDaTurma,
  somarPrazo,
  textoDoAviso,
} from './turmasCiclo';

const TRES_MESES = { quantidade: 3, unidade: 'MESES' } as const;

describe('somarPrazo', () => {
  it('soma meses mantendo o dia', () => {
    expect(somarPrazo('2026-03-10', TRES_MESES)).toBe('2026-06-10');
  });

  it('recua ao fim do mês quando o dia não existe', () => {
    expect(somarPrazo('2026-11-30', TRES_MESES)).toBe('2027-02-28');
    expect(somarPrazo('2027-11-30', TRES_MESES)).toBe('2028-02-29');
  });

  it('soma dias corridos atravessando o ano', () => {
    expect(somarPrazo('2026-12-20', { quantidade: 15, unidade: 'DIAS' })).toBe('2027-01-04');
  });
});

describe('leitura da configuração', () => {
  it('usa 3 meses quando nada foi gravado ou o valor é inválido', () => {
    expect(lerPrazoSaida(undefined)).toEqual(PRAZO_SAIDA_PADRAO);
    expect(lerPrazoSaida({ quantidade: -1, unidade: 'MESES' })).toEqual(PRAZO_SAIDA_PADRAO);
    expect(lerPrazoSaida({ quantidade: 2.5, unidade: 'DIAS' })).toEqual(PRAZO_SAIDA_PADRAO);
    expect(lerPrazoSaida({ quantidade: 45, unidade: 'DIAS' })).toEqual({ quantidade: 45, unidade: 'DIAS' });
  });

  it('ordena os marcos de aviso, remove repetidos e mantém o WhatsApp desligado por padrão', () => {
    const avisos = lerAvisosTurma({ diasAntes: [7, 30, 7, 400, -2, 1] });
    expect(avisos.diasAntes).toEqual([30, 7, 1]);
    expect(avisos.enviarWhatsApp).toBe(false);
    expect(avisos.textoPsicologo).toBe(AVISOS_TURMA_PADRAO.textoPsicologo);
  });

  it('aceita só datas de calendário reais', () => {
    expect(dataValida('2026-02-29')).toBeUndefined();
    expect(dataValida('2028-02-29')).toBe('2028-02-29');
    expect(dataValida('29/02/2028')).toBeUndefined();
  });
});

describe('situação da turma', () => {
  const encerrada = { encerradaEm: '2026-09-01' };

  it('turma sem encerramento está aberta', () => {
    expect(situacaoDaTurma({}, TRES_MESES, '2026-11-24')).toBe('ABERTA');
    expect(dataDeSaida({}, TRES_MESES)).toBeUndefined();
  });

  it('fica em prazo de saída até a data e sai no dia', () => {
    expect(dataDeSaida(encerrada, TRES_MESES)).toBe('2026-12-01');
    expect(situacaoDaTurma(encerrada, TRES_MESES, '2026-11-30')).toBe('EM_SAIDA');
    expect(situacaoDaTurma(encerrada, TRES_MESES, '2026-12-01')).toBe('DESLIGADA');
  });

  it('a data manual prevalece sobre o prazo configurado', () => {
    const prorrogada = { ...encerrada, saidaManual: '2027-01-15' };
    expect(dataDeSaida(prorrogada, TRES_MESES)).toBe('2027-01-15');
    expect(situacaoDaTurma(prorrogada, TRES_MESES, '2026-12-20')).toBe('EM_SAIDA');
  });

  it('retirada interrompida não sai da vitrine nem depois da data', () => {
    expect(situacaoDaTurma({ ...encerrada, retiradaInterrompida: true }, TRES_MESES, '2027-06-01')).toBe('SAIDA_INTERROMPIDA');
  });
});

describe('avisos da contagem', () => {
  const avisos = { diasAntes: [60, 30, 15, 7, 1] };

  it('o marco vigente é o menor já alcançado', () => {
    expect(marcoDoAviso(75, avisos)).toBeUndefined();
    expect(marcoDoAviso(60, avisos)).toBe(60);
    expect(marcoDoAviso(20, avisos)).toBe(30);
    expect(marcoDoAviso(3, avisos)).toBe(7);
    expect(marcoDoAviso(0, avisos)).toBe(1);
  });

  it('preenche os marcadores do texto da Gestão', () => {
    const texto = textoDoAviso('Turma {turma} de {curso}: encerrada {encerramento}, saída {saida}, {restante}. {outro}', {
      turma: '26A', curso: 'Curso Exemplo', encerradaEm: '2026-09-01', saidaEm: '2026-12-01', diasRestantes: 7,
    });
    expect(texto).toBe('Turma 26A de Curso Exemplo: encerrada 01/09/2026, saída 01/12/2026, faltam 7 dias. {outro}');
  });

  it('rotula o restante no singular e no dia da saída', () => {
    expect(rotuloRestante(1)).toBe('falta 1 dia');
    expect(rotuloRestante(0)).toBe('sai hoje');
  });
});

describe('normalizarCodigoTurma', () => {
  it('aceita "Turma 26a" e rejeita vazio ou símbolos', () => {
    expect(normalizarCodigoTurma(' Turma 26a ')).toBe('26A');
    expect(normalizarCodigoTurma('')).toBeUndefined();
    expect(normalizarCodigoTurma('<26A>')).toBeUndefined();
  });
});

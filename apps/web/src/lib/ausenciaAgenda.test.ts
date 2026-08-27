import { describe, expect, it } from 'vitest';
import { ausenciaEmCurso, diasDeAusencia, periodoAusencia } from './ausenciaAgenda';

/**
 * Os instantes abaixo são os que `parseAgendaBlockInput` produz: meia-noite no
 * fuso da clínica vira 03:00 UTC, e o fim é exclusivo — a meia-noite do dia
 * seguinte ao último dia de folga.
 */
const folgaDia10 = { inicio: '2026-09-10T03:00:00.000Z', fim: '2026-09-11T03:00:00.000Z' };
const feriasDe10A24 = { inicio: '2026-09-10T03:00:00.000Z', fim: '2026-09-25T03:00:00.000Z' };

describe('periodoAusencia', () => {
  it('descreve um único dia sem citar o dia seguinte', () => {
    // O fim exclusivo é 11/09; dizer "de 10 a 11" afirmaria folga num dia
    // em que a pessoa já voltou.
    expect(periodoAusencia(folgaDia10)).toBe('no dia 10/09');
  });

  it('descreve um intervalo pelo último dia realmente coberto', () => {
    expect(periodoAusencia(feriasDe10A24)).toBe('de 10/09 a 24/09');
  });

  it('não quebra com datas inválidas', () => {
    expect(periodoAusencia({ inicio: 'qualquer coisa', fim: 'outra' })).toBe(
      'em período não informado'
    );
  });
});

describe('diasDeAusencia', () => {
  it('conta um dia para a folga de um dia', () => {
    expect(diasDeAusencia(folgaDia10)).toBe(1);
  });

  it('conta os dias inteiros do intervalo', () => {
    expect(diasDeAusencia(feriasDe10A24)).toBe(15);
  });

  it('nunca devolve menos de um dia', () => {
    expect(diasDeAusencia({ inicio: folgaDia10.fim, fim: folgaDia10.inicio })).toBe(1);
  });
});

describe('ausenciaEmCurso', () => {
  const durante = new Date('2026-09-12T15:00:00.000Z');

  it('encontra a ausência que cobre o instante', () => {
    expect(ausenciaEmCurso([feriasDe10A24], durante)).toBe(feriasDe10A24);
  });

  it('ignora ausência que ainda não começou', () => {
    expect(ausenciaEmCurso([feriasDe10A24], new Date('2026-09-01T12:00:00.000Z'))).toBeUndefined();
  });

  it('libera no instante exato do fim, sem ninguém desmarcar', () => {
    // É esta borda que dispensa um job para devolver a pessoa ao rodízio.
    expect(ausenciaEmCurso([feriasDe10A24], new Date(feriasDe10A24.fim))).toBeUndefined();
  });

  it('devolve indefinido quando não há ausência alguma', () => {
    expect(ausenciaEmCurso(undefined, durante)).toBeUndefined();
    expect(ausenciaEmCurso([], durante)).toBeUndefined();
  });
});

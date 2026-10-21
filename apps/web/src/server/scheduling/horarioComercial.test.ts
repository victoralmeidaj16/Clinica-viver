import { describe, expect, it } from 'vitest';
import { horarioComercialConfigurado, proximaAberturaComercial } from './horarioComercial';

const padrao = horarioComercialConfigurado({});

describe('horário comercial da clínica', () => {
  it('dentro do expediente não adia', () => {
    // Quarta, 10:00 em São Paulo.
    expect(proximaAberturaComercial(new Date('2026-10-21T13:00:00Z'), padrao)).toBeNull();
  });

  it('à noite adia para as 08:00 do dia útil seguinte', () => {
    // Quarta, 23:00 em São Paulo → quinta, 08:00.
    expect(proximaAberturaComercial(new Date('2026-10-22T02:00:00Z'), padrao)?.toISOString())
      .toBe('2026-10-22T11:00:00.000Z');
  });

  it('de madrugada adia para as 08:00 do mesmo dia', () => {
    expect(proximaAberturaComercial(new Date('2026-10-21T09:30:00Z'), padrao)?.toISOString())
      .toBe('2026-10-21T11:00:00.000Z');
  });

  it('o fechamento é exclusivo e sexta à noite vai para segunda', () => {
    // Sexta, 18:00 em São Paulo → segunda, 08:00.
    expect(proximaAberturaComercial(new Date('2026-10-23T21:00:00Z'), padrao)?.toISOString())
      .toBe('2026-10-26T11:00:00.000Z');
  });

  it('aceita configuração por ambiente e ignora a inválida', () => {
    const sabado = horarioComercialConfigurado({ AGENDA_AVISOS_DIAS: '1,2,3,4,5,6', AGENDA_AVISOS_INICIO: '09:00', AGENDA_AVISOS_FIM: '13:00' });
    // Sábado, 10:00 em São Paulo.
    expect(proximaAberturaComercial(new Date('2026-10-24T13:00:00Z'), sabado)).toBeNull();
    expect(horarioComercialConfigurado({ AGENDA_AVISOS_INICIO: '18:00', AGENDA_AVISOS_FIM: '08:00' })).toEqual(padrao);
  });
});

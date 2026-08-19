import { describe, expect, it } from 'vitest';
import { blocosDaData, slotsDaData } from './agendaCalendarModel';

describe('agendaCalendarModel', () => {
  it('gera os horários recorrentes para uma data específica', () => {
    const slots = slotsDaData('2026-08-25', [{
      diaSemana: 2, horaInicio: '13:00', horaFim: '16:00', duracaoMin: 50, modalidade: 'online',
    }]);
    expect(slots.map((slot) => `${slot.horaInicio}-${slot.horaFim}`)).toEqual([
      '13:00-13:50', '13:50-14:40', '14:40-15:30',
    ]);
    expect(slots[0].inicio).toBe('2026-08-25T16:00:00.000Z');
  });

  it('encontra bloqueio parcial somente na data correspondente', () => {
    const blocos = [{
      id: 'block-1', inicio: '2026-08-25T18:00:00.000Z', fim: '2026-08-25T18:50:00.000Z',
    }];
    expect(blocosDaData(blocos, '2026-08-25')).toHaveLength(1);
    expect(blocosDaData(blocos, '2026-08-26')).toHaveLength(0);
  });
});

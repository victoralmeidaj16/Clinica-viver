import { describe, expect, it } from 'vitest';
import { blocosDaData, dataLocal, dataPorExtenso, slotsDaData } from './agendaCalendarModel';

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

  it('formata data por extenso em português', () => {
    const formatado = dataPorExtenso('2026-09-16');
    expect(formatado.toLowerCase()).toContain('quarta');
    expect(formatado.toLowerCase()).toContain('16');
    expect(formatado.toLowerCase()).toContain('setembro');
  });

  it('formata data local no fuso de São Paulo (YYYY-MM-DD)', () => {
    // 2026-09-10 02:00 UTC ainda é 2026-09-09 às 23:00 em São Paulo (-03:00)
    expect(dataLocal('2026-09-10T02:00:00.000Z')).toBe('2026-09-09');
    // 2026-09-10 03:00 UTC é exatamente 2026-09-10 às 00:00 em São Paulo
    expect(dataLocal('2026-09-10T03:00:00.000Z')).toBe('2026-09-10');
  });
});



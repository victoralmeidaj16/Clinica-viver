import { describe, expect, it } from 'vitest';
import { commonBookingTimes, recurringAvailableDates } from './publicBookingRecurrence';

describe('recorrência no agendamento público', () => {
  const available = ['2026-09-08', '2026-09-15', '2026-09-22', '2026-09-29', '2026-10-06'];

  it('seleciona recorrências semanais somente no mês inicial', () => {
    expect(recurringAvailableDates('2026-09-08', available, 'weekly')).toEqual(available.slice(0, 4));
  });

  it('seleciona recorrências quinzenais', () => {
    expect(recurringAvailableDates('2026-09-08', available, 'biweekly')).toEqual(['2026-09-08', '2026-09-22']);
  });

  it('oferece apenas horários livres em todas as datas', () => {
    const days = [
      { dia: '2026-09-08', horarios: [{ inicio: 'a', hora: '17:00', modalidade: 'online' }, { inicio: 'b', hora: '18:00', modalidade: 'online' }] },
      { dia: '2026-09-15', horarios: [{ inicio: 'c', hora: '17:00', modalidade: 'online' }] },
    ];
    expect(commonBookingTimes(['2026-09-08', '2026-09-15'], days)).toEqual([
      { hora: '17:00', modalidade: 'online', inicios: ['a', 'c'] },
    ]);
  });
});

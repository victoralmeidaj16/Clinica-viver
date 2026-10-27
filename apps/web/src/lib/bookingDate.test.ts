import { describe, expect, it } from 'vitest';
import { rotuloDataAgendamento } from './bookingDate';

describe('data de agendamento', () => {
  it('usa a data de São Paulo para uma sessão noturna que cruza a meia-noite UTC', () => {
    expect(rotuloDataAgendamento('2026-11-04T00:00:00.000Z')).toContain('03 de novembro');
  });
});

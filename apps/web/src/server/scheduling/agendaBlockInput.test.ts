import { describe, expect, it } from 'vitest';
import { parseAgendaBlockInput } from './agendaBlockInput';

describe('parseAgendaBlockInput', () => {
  const agora = new Date('2026-08-19T12:00:00.000Z');

  it('converte um bloqueio pontual no fuso da clínica', () => {
    expect(parseAgendaBlockInput({
      tipo: 'horario', data: '2026-08-25', horaInicio: '15:00', horaFim: '15:50', motivo: ' Compromisso externo ',
    }, agora)).toEqual({
      ok: true,
      intervalo: {
        inicio: '2026-08-25T18:00:00.000Z',
        fim: '2026-08-25T18:50:00.000Z',
        motivo: 'Compromisso externo',
        tipo: 'horario',
      },
    });
  });

  it('mantém o bloqueio de dia inteiro inclusivo', () => {
    expect(parseAgendaBlockInput({ inicioDia: '2026-08-25', fimDia: '2026-08-27' }, agora)).toMatchObject({
      ok: true,
      intervalo: {
        inicio: '2026-08-25T03:00:00.000Z',
        fim: '2026-08-28T03:00:00.000Z',
        tipo: 'dia',
      },
    });
  });

  it('recusa intervalo invertido', () => {
    expect(parseAgendaBlockInput({
      tipo: 'horario', data: '2026-08-25', horaInicio: '16:00', horaFim: '15:00',
    }, agora)).toEqual({ ok: false, mensagem: 'O horário final deve ser posterior ao inicial.' });
  });

  it('recusa datas inexistentes', () => {
    expect(parseAgendaBlockInput({ inicioDia: '2026-02-30' }, agora)).toEqual({
      ok: false,
      mensagem: 'Informe as datas do bloqueio.',
    });
  });

  it('recusa um horário que já terminou', () => {
    expect(parseAgendaBlockInput({
      tipo: 'horario', data: '2026-08-19', horaInicio: '07:00', horaFim: '08:00',
    }, agora)).toEqual({ ok: false, mensagem: 'Escolha um horário futuro para o bloqueio.' });
  });
});

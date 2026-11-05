import { describe, expect, it } from 'vitest';
import { erroDoNovoHorario } from './editSessionModel';

const AGORA = Date.parse('2099-01-01T15:00:00Z');
const PASSADO = Date.parse('2099-01-01T14:00:00Z');
const FUTURO = Date.parse('2099-01-01T16:00:00Z');

describe('erroDoNovoHorario', () => {
  it('recusa horário passado para o psicólogo', () => {
    expect(erroDoNovoHorario({ admin: false, horarioMudou: true, inicio: PASSADO, agora: AGORA }))
      .toBe('O novo horário deve estar no futuro.');
  });

  it('libera horário passado para a gestão', () => {
    expect(erroDoNovoHorario({ admin: true, horarioMudou: true, inicio: PASSADO, agora: AGORA })).toBeUndefined();
  });

  it('não reclama de sessão passada cujo horário não mudou', () => {
    expect(erroDoNovoHorario({ admin: false, horarioMudou: false, inicio: PASSADO, agora: AGORA })).toBeUndefined();
  });

  it('aceita horário futuro para todos', () => {
    expect(erroDoNovoHorario({ admin: false, horarioMudou: true, inicio: FUTURO, agora: AGORA })).toBeUndefined();
  });
});

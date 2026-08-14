import { describe, expect, it } from 'vitest';
import {
  diaLocal,
  gerarSlots,
  horaLocal,
  instanteLocal,
  primeiroNome,
  type IntervaloOcupado,
  type JanelaDisponibilidade,
} from './availabilityGrid';

// Quarta-feira, 19/08/2026.
const QUARTA = '2026-08-19';
const janelaQuarta: JanelaDisponibilidade = {
  diaSemana: 3,
  horaInicio: '08:00',
  horaFim: '10:00',
  duracaoMin: 50,
  modalidade: 'online',
};

const inicioDoDia = new Date(instanteLocal(QUARTA, '00:00'));
const fimDoDia = new Date(instanteLocal(QUARTA, '23:59'));
const vespera = new Date(instanteLocal('2026-08-18', '10:00'));

describe('conversão de fuso da clínica', () => {
  it('trata a hora declarada como horário de Brasília', () => {
    expect(new Date(instanteLocal(QUARTA, '08:00')).toISOString()).toBe('2026-08-19T11:00:00.000Z');
  });

  it('devolve dia e hora locais de um instante UTC', () => {
    const instante = Date.parse('2026-08-20T01:30:00.000Z');
    expect(diaLocal(instante)).toBe('2026-08-19');
    expect(horaLocal(instante)).toBe('22:30');
  });
});

describe('gerarSlots', () => {
  it('parte a janela em horários da duração declarada', () => {
    const slots = gerarSlots([janelaQuarta], [], inicioDoDia, fimDoDia, vespera);
    expect(slots.map((slot) => slot.hora)).toEqual(['08:00', '08:50']);
    expect(slots[0].modalidade).toBe('online');
    expect(slots[0].dia).toBe(QUARTA);
  });

  it('descarta o resto que não completa uma sessão inteira', () => {
    const slots = gerarSlots(
      [{ ...janelaQuarta, horaFim: '09:30' }],
      [],
      inicioDoDia,
      fimDoDia,
      vespera
    );
    expect(slots.map((slot) => slot.hora)).toEqual(['08:00']);
  });

  it('remove horários que colidem com agendamento ou bloqueio', () => {
    const ocupado: IntervaloOcupado = {
      inicio: instanteLocal(QUARTA, '08:30'),
      fim: instanteLocal(QUARTA, '09:00'),
    };
    const slots = gerarSlots([janelaQuarta], [ocupado], inicioDoDia, fimDoDia, vespera);
    expect(slots).toHaveLength(0);
  });

  it('ignora a janela cujo dia da semana não bate com a data', () => {
    const slots = gerarSlots(
      [{ ...janelaQuarta, diaSemana: 1 }],
      [],
      inicioDoDia,
      fimDoDia,
      vespera
    );
    expect(slots).toHaveLength(0);
  });

  it('respeita a vigência declarada na janela', () => {
    const slots = gerarSlots(
      [{ ...janelaQuarta, vigenciaFim: '2026-08-18' }],
      [],
      inicioDoDia,
      fimDoDia,
      vespera
    );
    expect(slots).toHaveLength(0);
  });

  it('não oferece horário dentro da antecedência mínima', () => {
    // Janela 08:00–12:00 em sessões de 50 min: 08:00, 08:50, 09:40 e 10:30 —
    // 11:20 não cabe porque terminaria 12:10. Às 07:30 o piso é 09:30, então
    // sobram os dois últimos.
    const manhaInteira = { ...janelaQuarta, horaFim: '12:00' };
    const agora = new Date(instanteLocal(QUARTA, '07:30'));
    const slots = gerarSlots([manhaInteira], [], inicioDoDia, fimDoDia, agora);
    expect(slots.map((slot) => slot.hora)).toEqual(['09:40', '10:30']);
  });

  it('não oferece nada quando não há janela cadastrada', () => {
    expect(gerarSlots([], [], inicioDoDia, fimDoDia, vespera)).toEqual([]);
  });

  it('ordena os horários de várias janelas do mesmo dia', () => {
    const tarde: JanelaDisponibilidade = {
      ...janelaQuarta,
      horaInicio: '14:00',
      horaFim: '15:00',
      modalidade: 'presencial',
    };
    const slots = gerarSlots([tarde, janelaQuarta], [], inicioDoDia, fimDoDia, vespera);
    expect(slots.map((slot) => slot.hora)).toEqual(['08:00', '08:50', '14:00']);
  });
});

describe('primeiroNome', () => {
  it('devolve só o primeiro nome do cadastro', () => {
    expect(primeiroNome('  Maria Clara Souza ')).toBe('Maria');
  });
});

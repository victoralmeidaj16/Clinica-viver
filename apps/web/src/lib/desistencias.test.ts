import { describe, expect, it } from 'vitest';
import { desistenciaDoPaciente, motivoValido, rotuloMotivo } from './desistencias';

const registro = (campos: Partial<{ id: string; pacienteId: string; leadId: string; dataDesistencia: string }>) => ({
  id: 'desistencia-1',
  dataDesistencia: '2026-08-01T12:00:00.000Z',
  ...campos,
});

describe('casamento entre desistência e linha da fila', () => {
  it('encontra pelo paciente já cadastrado', () => {
    const registros = [registro({ id: 'd-1', pacienteId: 'pac-1' })];
    expect(desistenciaDoPaciente(registros, { patientId: 'pac-1' })?.id).toBe('d-1');
  });

  it('encontra pelo lead de quem desistiu antes de virar paciente', () => {
    const registros = [registro({ id: 'd-2', leadId: 'triagem-9' })];
    expect(desistenciaDoPaciente(registros, { leadId: 'triagem-9' })?.id).toBe('d-2');
  });

  it('encontra pelo lead mesmo quando a linha também tem paciente', () => {
    const registros = [registro({ id: 'd-3', leadId: 'triagem-9' })];
    expect(desistenciaDoPaciente(registros, { patientId: 'pac-1', leadId: 'triagem-9' })?.id).toBe('d-3');
  });

  it('não atribui dono a registro antigo, sem paciente e sem lead', () => {
    const registros = [registro({ id: 'orfao' })];
    expect(desistenciaDoPaciente(registros, { patientId: 'pac-1', leadId: 'triagem-9' })).toBeUndefined();
  });

  it('não devolve nada quando a linha não tem chave alguma', () => {
    const registros = [registro({ id: 'd-1', pacienteId: 'pac-1' })];
    expect(desistenciaDoPaciente(registros, {})).toBeUndefined();
  });

  it('não confunde pacientes diferentes', () => {
    const registros = [registro({ id: 'd-1', pacienteId: 'pac-1' })];
    expect(desistenciaDoPaciente(registros, { patientId: 'pac-2' })).toBeUndefined();
  });

  it('devolve a saída mais recente quando há mais de uma, seja qual for a ordem gravada', () => {
    const registros = [
      registro({ id: 'antiga', pacienteId: 'pac-1', dataDesistencia: '2026-02-01T10:00:00.000Z' }),
      registro({ id: 'recente', pacienteId: 'pac-1', dataDesistencia: '2026-07-01T10:00:00.000Z' }),
    ];
    expect(desistenciaDoPaciente(registros, { patientId: 'pac-1' })?.id).toBe('recente');
    expect(desistenciaDoPaciente([...registros].reverse(), { patientId: 'pac-1' })?.id).toBe('recente');
  });
});

describe('vocabulário dos motivos', () => {
  it('aceita os motivos previstos e recusa o resto', () => {
    expect(motivoValido('FINANCEIRO')).toBe(true);
    expect(motivoValido('OUTRO')).toBe(true);
    expect(motivoValido('financeiro')).toBe(false);
    expect(motivoValido('QUALQUER_COISA')).toBe(false);
    expect(motivoValido(undefined)).toBe(false);
  });

  it('traduz o motivo e devolve o valor cru quando não conhece', () => {
    expect(rotuloMotivo('FINANCEIRO')).toBe('Financeiro / valor da sessão');
    expect(rotuloMotivo('DESCONHECIDO')).toBe('DESCONHECIDO');
  });
});

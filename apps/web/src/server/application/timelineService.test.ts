import { describe, expect, it } from 'vitest';
import { parseManualClinicalRecordInput } from './manualClinicalRecordInput';

describe('parseManualClinicalRecordInput', () => {
  it('normaliza um prontuário manual válido', () => {
    expect(parseManualClinicalRecordInput({
      patientId: ' paciente-1 ',
      title: ' Sessão semanal ',
      subjective: ' Relato clínico ',
      objective: '',
      assessment: '',
      plan: '',
    })).toEqual({
      patientId: 'paciente-1',
      title: 'Sessão semanal',
      subjective: 'Relato clínico',
      objective: '',
      assessment: '',
      plan: '',
    });
  });

  it('recusa salvar um prontuário sem conteúdo clínico', () => {
    expect(() => parseManualClinicalRecordInput({
      patientId: 'paciente-1',
      title: 'Sessão semanal',
    })).toThrow('Preencha ao menos uma anotação clínica.');
  });

  it('limita cada campo SOAP ao tamanho aceito pela linha do tempo', () => {
    expect(() => parseManualClinicalRecordInput({
      patientId: 'paciente-1',
      title: 'Sessão semanal',
      subjective: 'x'.repeat(2_001),
    })).toThrow('Subjetivo deve ter no máximo 2000 caracteres.');
  });
});

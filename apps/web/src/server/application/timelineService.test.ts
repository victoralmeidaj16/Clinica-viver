import { describe, expect, it } from 'vitest';
import { manualSoapExcerpt, parseManualClinicalRecordInput } from './manualClinicalRecordInput';

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

describe('manualSoapExcerpt', () => {
  it('reúne os campos SOAP preenchidos num único prontuário, na ordem clínica', () => {
    expect(manualSoapExcerpt({
      patientId: 'paciente-1',
      title: 'Sessão semanal',
      subjective: 'Relato',
      objective: '',
      assessment: 'Hipótese',
      plan: 'Retorno',
    })).toBe('Subjetivo: Relato\n\nAvaliação: Hipótese\n\nPlano: Retorno');
  });
});

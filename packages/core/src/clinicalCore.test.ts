import { describe, expect, it } from 'vitest';
import { anonymizeClinicalNote } from './anonymizer';
import { generatePsychometricAiInsight } from './assessmentAiInterpreter';
import {
  calculateAssessmentScore,
  GAD7_INSTRUMENT,
  PHQ9_INSTRUMENT,
} from './assessments';
import { buildSoapPrompt } from './soapEngine';
import {
  completeAssessment,
  createAssessmentAssignment,
  getActiveRiskAlerts,
} from './assessmentWorkflow';

describe('calculateAssessmentScore', () => {
  it('disponibiliza todos os itens oficiais implementados', () => {
    expect(PHQ9_INSTRUMENT.questions).toHaveLength(9);
    expect(PHQ9_INSTRUMENT.questions.map(({ id }) => id)).toEqual([
      'q1',
      'q2',
      'q3',
      'q4',
      'q5',
      'q6',
      'q7',
      'q8',
      'q9',
    ]);
    expect(PHQ9_INSTRUMENT.followUpQuestions).toHaveLength(1);
    expect(GAD7_INSTRUMENT.questions).toHaveLength(7);
  });

  it('classifica PHQ-9 e ativa alerta quando o item 9 é positivo', () => {
    const result = calculateAssessmentScore('PHQ-9', {
      q1: 2,
      q2: 2,
      q3: 1,
      q4: 1,
      q5: 1,
      q6: 1,
      q7: 1,
      q8: 0,
      q9: 1,
    });

    expect(result.totalScore).toBe(10);
    expect(result.severityLabel).toBe('Moderada');
    expect(result.hasRiskAlert).toBe(true);
  });

  it('classifica GAD-7 sem gerar alerta de risco indevido', () => {
    const result = calculateAssessmentScore('GAD-7', {
      q1: 2,
      q2: 2,
      q3: 2,
      q4: 2,
      q5: 1,
      q6: 1,
      q7: 0,
    });

    expect(result.totalScore).toBe(10);
    expect(result.severityLabel).toBe('Moderada');
    expect(result.hasRiskAlert).toBe(false);
  });

  it('não inclui a pergunta de impacto funcional no escore PHQ-9', () => {
    const result = calculateAssessmentScore('PHQ-9', {
      q1: 1,
      q2: 1,
      q3: 1,
      q4: 1,
      q5: 1,
      q6: 1,
      q7: 1,
      q8: 1,
      q9: 0,
      functionalImpact: 3,
    });

    expect(result.totalScore).toBe(8);
  });

  it('recusa cálculo clínico com respostas incompletas', () => {
    expect(() => calculateAssessmentScore('GAD-7', { q1: 1, q2: 2 })).toThrow(
      'Resposta ausente ou inválida para GAD-7/q3.'
    );
  });
});

describe('assessment workflow', () => {
  it('atribui, conclui e preserva o vínculo pseudonimizado com o paciente', () => {
    const assignment = createAssessmentAssignment({
      id: 'assignment-1',
      patientId: 'pac-01',
      instrumentCode: 'PHQ-9',
      assignedAt: '2026-07-30T10:00:00.000Z',
    });
    const completed = completeAssessment({
      id: 'response-1',
      assignment,
      completedAt: '2026-07-30T10:05:00.000Z',
      answers: {
        q1: 0,
        q2: 0,
        q3: 0,
        q4: 0,
        q5: 0,
        q6: 0,
        q7: 0,
        q8: 0,
        q9: 1,
      },
      followUpAnswers: { functionalImpact: 1 },
    });

    expect(completed.assignment.status).toBe('completed');
    expect(completed.response.patientId).toBe('pac-01');
    expect(completed.response.totalScore).toBe(1);
    expect(getActiveRiskAlerts([completed.response])).toEqual([completed.response]);
  });

  it('impede conclusão duplicada da mesma aplicação', () => {
    const assignment = createAssessmentAssignment({
      id: 'assignment-2',
      patientId: 'pac-02',
      instrumentCode: 'GAD-7',
      assignedAt: '2026-07-30T10:00:00.000Z',
    });

    expect(() =>
      completeAssessment({
        id: 'response-2',
        assignment: { ...assignment, status: 'completed' },
        completedAt: '2026-07-30T10:05:00.000Z',
        answers: {},
      })
    ).toThrow('Somente uma aplicação pendente pode ser concluída.');
  });
});

describe('anonymizeClinicalNote', () => {
  it('remove ocorrências estruturadas e identificadores conhecidos', () => {
    const result = anonymizeClinicalNote(
      'Mariana usa os CPFs 342.190.878-10 e 11122233344. Contato: psi@example.com.',
      { knownIdentifiers: ['Mariana'] }
    );

    expect(result.textAnonymized).not.toContain('Mariana');
    expect(result.textAnonymized).not.toContain('342.190.878-10');
    expect(result.textAnonymized).not.toContain('11122233344');
    expect(result.textAnonymized).not.toContain('psi@example.com');
    expect(result.piiRemovedCount).toBe(4);
  });
});

describe('buildSoapPrompt', () => {
  it('proíbe a fabricação de observações indisponíveis no áudio', () => {
    const prompt = buildSoapPrompt({
      patientReference: 'PAC-001',
      transcription: 'Paciente relata ansiedade antes de reuniões.',
    });

    expect(prompt).toContain('Não invente contato visual');
    expect(prompt).toContain('revisão obrigatória');
    expect(prompt).toContain('PAC-001');
  });
});

describe('generatePsychometricAiInsight', () => {
  it('não produz protocolo indefinido quando não há sugestão automatizada', () => {
    const result = generatePsychometricAiInsight({
      id: 'assessment-1',
      instrumentCode: 'BDI-II',
      patientId: 'patient-1',
      appliedAt: '2026-07-30',
      answers: {},
      totalScore: 0,
      severityLabel: 'Não classificado',
      hasRiskAlert: false,
    });

    expect(result.soapAssessmentDraft).not.toContain('undefined');
    expect(result.soapAssessmentDraft).toContain('avaliação clínica individualizada');
  });
});

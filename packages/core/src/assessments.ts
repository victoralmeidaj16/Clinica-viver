import type {
  AssessmentInstrument,
  AssessmentScoreResult,
  SupportedAssessmentCode,
} from './assessmentTypes';
import { GAD7_INSTRUMENT } from './instruments/gad7';
import { PHQ9_INSTRUMENT } from './instruments/phq9';

export * from './assessmentTypes';
export { GAD7_INSTRUMENT, PHQ9_INSTRUMENT };

export const ASSESSMENT_INSTRUMENTS: Record<SupportedAssessmentCode, AssessmentInstrument> = {
  'PHQ-9': PHQ9_INSTRUMENT,
  'GAD-7': GAD7_INSTRUMENT,
};

export function isSupportedAssessmentCode(code: string): code is SupportedAssessmentCode {
  return code in ASSESSMENT_INSTRUMENTS;
}

export function getAssessmentInstrument(code: string): AssessmentInstrument | undefined {
  return isSupportedAssessmentCode(code) ? ASSESSMENT_INSTRUMENTS[code] : undefined;
}

function validateScoredAnswers(
  instrument: AssessmentInstrument,
  answers: Record<string, number>
): void {
  for (const question of instrument.questions) {
    const value = answers[question.id];
    const isAllowed = question.options.some((option) => option.value === value);
    if (!Number.isInteger(value) || !isAllowed) {
      throw new Error(`Resposta ausente ou inválida para ${instrument.code}/${question.id}.`);
    }
  }
}

export function calculateAssessmentScore(
  instrumentCode: SupportedAssessmentCode,
  answers: Record<string, number>
): AssessmentScoreResult {
  const instrument = ASSESSMENT_INSTRUMENTS[instrumentCode];
  validateScoredAnswers(instrument, answers);

  const totalScore = instrument.questions.reduce(
    (total, question) => total + answers[question.id],
    0
  );

  let severityLabel = 'Mínima';
  let hasRiskAlert = false;
  let riskAlertReason: string | undefined;

  if (instrumentCode === 'PHQ-9') {
    if (totalScore >= 20) severityLabel = 'Grave';
    else if (totalScore >= 15) severityLabel = 'Moderadamente grave';
    else if (totalScore >= 10) severityLabel = 'Moderada';
    else if (totalScore >= 5) severityLabel = 'Leve';

    if (answers.q9 > 0) {
      hasRiskAlert = true;
      riskAlertReason =
        'Resposta positiva no item 9. Requer avaliação clínica de risco e aplicação do protocolo definido pelo serviço.';
    }
  } else {
    if (totalScore >= 15) severityLabel = 'Grave';
    else if (totalScore >= 10) severityLabel = 'Moderada';
    else if (totalScore >= 5) severityLabel = 'Leve';
  }

  return { totalScore, severityLabel, hasRiskAlert, riskAlertReason };
}

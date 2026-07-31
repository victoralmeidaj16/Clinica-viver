export type SupportedAssessmentCode = 'PHQ-9' | 'GAD-7';
export type CatalogAssessmentCode = SupportedAssessmentCode | 'BDI-II' | 'BAI';

export interface QuestionOption {
  value: number;
  label: string;
}

export interface Question {
  id: string;
  statement: string;
  options: readonly QuestionOption[];
}

export interface AssessmentSource {
  title: string;
  language: 'pt-BR';
  url: string;
  attribution: string;
  permissionNotice: string;
}

export interface AssessmentInstrument {
  id: string;
  code: SupportedAssessmentCode;
  title: string;
  description: string;
  category: 'Depressão' | 'Ansiedade';
  instructions: string;
  questionsCount: number;
  maxScore: number;
  questions: readonly Question[];
  followUpQuestions?: readonly Question[];
  source: AssessmentSource;
}

export interface AssessmentScoreResult {
  totalScore: number;
  severityLabel: string;
  hasRiskAlert: boolean;
  riskAlertReason?: string;
}

export interface AssessmentResponse extends AssessmentScoreResult {
  id: string;
  instrumentCode: CatalogAssessmentCode;
  patientId: string;
  appliedAt: string;
  answers: Record<string, number>;
}

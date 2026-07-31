/**
 * AI Psychometric Interpreter & Protocol Recommendation Engine
 */

import { AssessmentResponse } from './assessments';

export interface AiInterpretationResult {
  summary: string;
  trendAnalysis: string; // Ex: "Redução de 35% na ansiedade em relação ao baseline"
  protocolSuggestions: string[];
  soapAssessmentDraft: string;
}

export function generatePsychometricAiInsight(
  current: AssessmentResponse,
  previous?: AssessmentResponse
): AiInterpretationResult {
  const code = current.instrumentCode;
  const score = current.totalScore;
  const severity = current.severityLabel;

  let deltaText = 'Primeira aplicação (Linha de Base estabelecida)';
  if (previous) {
    const delta = score - previous.totalScore;
    if (delta < 0) {
      deltaText = `Melhoria clínica de ${Math.abs(delta)} pontos em relação à última aplicação (${previous.totalScore} ➔ ${score}).`;
    } else if (delta > 0) {
      deltaText = `⚠️ Elevação de ${delta} pontos na pontuação (${previous.totalScore} ➔ ${score}). Indicação de exacerbação dos sintomas.`;
    } else {
      deltaText = `Estabilidade sintomática mantida (${score} pontos).`;
    }
  }

  const protocolSuggestions: string[] = [];
  if (code === 'PHQ-9') {
    protocolSuggestions.push('Protocolo TCC para Ativação Comportamental (Beck)');
    protocolSuggestions.push('Registro de Pensamentos Automáticos (RPD) focado em ruminação');
    protocolSuggestions.push('Estruturação de rotina de sono e atividades de domínio/prazer');
  } else if (code === 'GAD-7') {
    protocolSuggestions.push('Treino em Respiração Diafragmática & Desaceleração Fisiológica');
    protocolSuggestions.push('Protocolo ACT (Terapia de Aceitação e Compromisso) para desfusão cognitiva');
    protocolSuggestions.push('Técnica de Solução de Problemas em 5 Etapas');
  }

  const protocolText = protocolSuggestions[0]
    ? `Sugestão para revisão profissional: ${protocolSuggestions[0]}.`
    : 'A definição de conduta requer avaliação clínica individualizada pelo profissional responsável.';

  const soapAssessmentDraft = `Aplicação do instrumento ${code} em ${current.appliedAt}: Pontuação total de ${score} pontos, indicando classificação de gravidade ${severity.toUpperCase()}. ${deltaText} ${protocolText}`;

  return {
    summary: `Resultado do ${code}: ${score} pontos (${severity}). ${current.hasRiskAlert ? '⚠️ ALERTA DE RISCO DETECTADO.' : 'Sem alertas de urgência.'}`,
    trendAnalysis: deltaText,
    protocolSuggestions,
    soapAssessmentDraft,
  };
}

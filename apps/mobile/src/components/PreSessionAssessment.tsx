import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  AssessmentScoreResult,
  calculateAssessmentScore,
  getAssessmentInstrument,
  PreSessionCheckIn,
  schedulePreSessionCheckIn,
  submitPreSessionCheckIn,
  SupportedAssessmentCode,
} from '@thats-life/core';
import { styles } from './preSessionAssessmentStyles';
import PreSessionTopicsStep from './PreSessionTopicsStep';

type QuizPhase = 'questions' | 'follow-up' | 'topics' | 'completed';

export default function PreSessionAssessment() {
  const [instrumentCode, setInstrumentCode] = useState<SupportedAssessmentCode>('PHQ-9');
  const [phase, setPhase] = useState<QuizPhase>('questions');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentScoreResult | null>(null);
  const [topicsToDiscuss, setTopicsToDiscuss] = useState('');
  const [submittedCheckIn, setSubmittedCheckIn] = useState<PreSessionCheckIn | null>(null);
  const instrument = getAssessmentInstrument(instrumentCode)!;

  const isFollowUp = phase === 'follow-up';
  const questions = isFollowUp ? instrument.followUpQuestions ?? [] : instrument.questions;
  const currentQuestion = questions[currentIndex];
  const answeredCount =
    Object.keys(answers).length + (isFollowUp ? Object.keys(followUpAnswers).length : 0);
  const totalSteps =
    instrument.questions.length + (isFollowUp ? instrument.followUpQuestions?.length ?? 0 : 0);
  const progressPercent =
    phase === 'completed' ? 100 : Math.round(((answeredCount + 1) / totalSteps) * 100);

  const resetQuiz = (code: SupportedAssessmentCode = instrumentCode) => {
    setInstrumentCode(code);
    setPhase('questions');
    setCurrentIndex(0);
    setAnswers({});
    setFollowUpAnswers({});
    setResult(null);
    setTopicsToDiscuss('');
    setSubmittedCheckIn(null);
  };

  const finishQuiz = (
    scoredAnswers: Record<string, number>,
    contextualAnswers: Record<string, number>
  ) => {
    setAnswers(scoredAnswers);
    setFollowUpAnswers(contextualAnswers);
    setResult(calculateAssessmentScore(instrument.code, scoredAnswers));
    setPhase('topics');
  };

  const handleSubmitCheckIn = () => {
    if (!result) return;
    const now = new Date();
    const occurredAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1_000).toISOString();
    const checkInId = `demo-check-in-${Date.now()}`;
    const scheduled = schedulePreSessionCheckIn(
      {
        id: checkInId,
        organizationId: 'demo-org-01',
        appointmentId: 'demo-appointment-01',
        patientId: 'demo-pac-01',
        professionalId: 'psi-demo-01',
        availableFrom: occurredAt,
        expiresAt,
        createdAt: occurredAt,
      },
      {
        actorUserId: 'demo-patient-user-01',
        occurredAt,
        correlationId: `${checkInId}-scheduled`,
      }
    ).checkIn;
    const submitted = submitPreSessionCheckIn(
      scheduled,
      {
        topicsToDiscuss,
        assessment: {
          responseId: `${checkInId}-assessment`,
          instrumentCode,
          totalScore: result.totalScore,
          severityLabel: result.severityLabel,
          hasRiskAlert: result.hasRiskAlert,
          riskAlertReason: result.riskAlertReason,
        },
      },
      {
        actorUserId: 'demo-patient-user-01',
        occurredAt,
        correlationId: `${checkInId}-submitted`,
      }
    ).checkIn;
    setSubmittedCheckIn(submitted);
    setPhase('completed');
  };

  const handleSelect = (value: number) => {
    if (isFollowUp) {
      finishQuiz(answers, { ...followUpAnswers, [currentQuestion.id]: value });
      return;
    }

    const updatedAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(updatedAnswers);
    if (currentIndex < instrument.questions.length - 1) {
      setCurrentIndex((index) => index + 1);
      return;
    }

    const needsFollowUp =
      Boolean(instrument.followUpQuestions?.length) &&
      Object.values(updatedAnswers).some((answer) => answer > 0);
    if (needsFollowUp) {
      setCurrentIndex(0);
      setPhase('follow-up');
    } else {
      finishQuiz(updatedAnswers, {});
    }
  };

  const handlePrevious = () => {
    if (isFollowUp) {
      setPhase('questions');
      setCurrentIndex(instrument.questions.length - 1);
    } else if (currentIndex > 0) {
      setCurrentIndex((index) => index - 1);
    }
  };

  const selectedAnswers = isFollowUp ? followUpAnswers : answers;

  return (
    <View style={styles.card}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
      </View>

      <View style={styles.instrumentTabs}>
        {(['PHQ-9', 'GAD-7'] as const).map((code) => (
          <TouchableOpacity
            key={code}
            accessibilityRole="button"
            onPress={() => resetQuiz(code)}
            style={[styles.instrumentTab, code === instrumentCode && styles.instrumentTabActive]}
          >
            <Text style={[styles.instrumentTabText, code === instrumentCode && styles.instrumentTabTextActive]}>
              {code}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.header}>
        <Text style={styles.badge}>Quiz pré-sessão • {instrument.code}</Text>
        <Text style={styles.progressPercent}>{progressPercent}%</Text>
      </View>

      {phase === 'questions' || phase === 'follow-up' ? (
        <View style={styles.quizBody}>
          <Text style={styles.stepCount}>
            {isFollowUp ? 'Impacto funcional' : `Pergunta ${currentIndex + 1} de ${instrument.questions.length}`}
          </Text>
          <Text style={styles.questionText}>{currentQuestion.statement}</Text>
          {!isFollowUp && <Text style={styles.subtext}>{instrument.instructions}</Text>}

          <View style={styles.optionsList}>
            {currentQuestion.options.map((option) => {
              const isSelected = selectedAnswers[currentQuestion.id] === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  style={[styles.optCard, isSelected && styles.optCardSelected]}
                  onPress={() => handleSelect(option.value)}
                >
                  <Text style={[styles.optLabel, isSelected && styles.optLabelSelected]}>
                    {option.label}
                  </Text>
                  <View style={[styles.badgeValue, isSelected && styles.badgeValueSelected]}>
                    <Text style={[styles.badgeValueText, isSelected && styles.badgeValueTextSelected]}>
                      {option.value}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {(isFollowUp || currentIndex > 0) && (
            <TouchableOpacity accessibilityRole="button" onPress={handlePrevious} style={styles.previousButton}>
              <Text style={styles.previousButtonText}>← Pergunta anterior</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : phase === 'topics' ? (
        <PreSessionTopicsStep
          value={topicsToDiscuss}
          onChange={setTopicsToDiscuss}
          onSubmit={handleSubmitCheckIn}
        />
      ) : (
        <View style={[styles.doneBox, result?.hasRiskAlert && styles.riskBox]}>
          <Text style={[styles.doneTitle, result?.hasRiskAlert && styles.riskTitle]}>
            {result?.hasRiskAlert ? 'Atenção clínica necessária' : '✓ Questionário concluído'}
          </Text>
          <Text style={styles.scoreText}>
            {result?.totalScore} de {instrument.maxScore} pontos • Gravidade {result?.severityLabel.toLowerCase()}
          </Text>
          <Text style={styles.doneText}>
            Resultado de rastreio, não diagnóstico. Nesta demonstração, o check-in
            permanece somente em memória e não foi enviado externamente.
          </Text>
          {submittedCheckIn?.response?.topicsToDiscuss ? (
            <Text style={styles.topicsConfirmation}>
              Assunto enviado: “{submittedCheckIn.response.topicsToDiscuss}”
            </Text>
          ) : (
            <Text style={styles.topicsConfirmation}>
              Nenhum assunto adicional foi informado.
            </Text>
          )}
          {result?.hasRiskAlert && <Text style={styles.riskText}>{result.riskAlertReason}</Text>}
          <TouchableOpacity accessibilityRole="button" onPress={() => resetQuiz()} style={styles.restartButton}>
            <Text style={styles.restartButtonText}>Responder novamente</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

'use client';

import React, { useState } from 'react';
import {
  AssessmentScoreResult,
  calculateAssessmentScore,
  getAssessmentInstrument,
  SupportedAssessmentCode,
} from '@thats-life/core';
import { AlertTriangle, ArrowLeft, ArrowRight, Brain, CheckCircle2, X } from 'lucide-react';

interface PatientQuizPlayerProps {
  instrumentCode: SupportedAssessmentCode;
  onClose: () => void;
  onFinishQuiz: (
    result: AssessmentScoreResult,
    answers: Record<string, number>,
    followUpAnswers: Record<string, number>
  ) => void;
}

type QuizPhase = 'questions' | 'follow-up' | 'completed';

export default function PatientQuizPlayer({
  instrumentCode,
  onClose,
  onFinishQuiz,
}: PatientQuizPlayerProps) {
  const instrument = getAssessmentInstrument(instrumentCode);
  const [phase, setPhase] = useState<QuizPhase>('questions');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [followUpAnswers, setFollowUpAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<AssessmentScoreResult | null>(null);

  if (!instrument) return null;

  const isFollowUp = phase === 'follow-up';
  const questions = isFollowUp ? instrument.followUpQuestions ?? [] : instrument.questions;
  const currentQuestion = questions[currentIndex];
  const answeredCount =
    Object.keys(answers).length + (isFollowUp ? Object.keys(followUpAnswers).length : 0);
  const totalSteps =
    instrument.questions.length +
    (isFollowUp ? instrument.followUpQuestions?.length ?? 0 : 0);
  const progressPercent =
    phase === 'completed' ? 100 : Math.round(((answeredCount + 1) / totalSteps) * 100);

  const finishQuiz = (
    scoredAnswers: Record<string, number>,
    contextualAnswers: Record<string, number>
  ) => {
    const scoreResult = calculateAssessmentScore(instrument.code, scoredAnswers);
    setResult(scoreResult);
    setPhase('completed');
    onFinishQuiz(scoreResult, scoredAnswers, contextualAnswers);
  };

  const handleSelectOption = (value: number) => {
    if (isFollowUp) {
      const updatedFollowUp = { ...followUpAnswers, [currentQuestion.id]: value };
      setFollowUpAnswers(updatedFollowUp);
      finishQuiz(answers, updatedFollowUp);
      return;
    }

    const updatedAnswers = { ...answers, [currentQuestion.id]: value };
    setAnswers(updatedAnswers);

    if (currentIndex < instrument.questions.length - 1) {
      setTimeout(() => setCurrentIndex((index) => index + 1), 180);
      return;
    }

    const needsFollowUp =
      Boolean(instrument.followUpQuestions?.length) &&
      Object.values(updatedAnswers).some((answer) => answer > 0);
    if (needsFollowUp) {
      setCurrentIndex(0);
      setPhase('follow-up');
    } else {
      finishQuiz(updatedAnswers, followUpAnswers);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-md animate-fadeIn">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        <div className="w-full bg-soft h-2" aria-label={`${progressPercent}% concluído`}>
          <div
            className="bg-gradient-to-r from-primary via-capri to-accent h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="p-6 pb-3 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Aplicação local • {instrument.code}
              </span>
              <h3 className="text-sm font-extrabold text-ink">{instrument.title}</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar questionário" className="text-muted hover:text-ink p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-8 min-h-[390px] flex flex-col justify-between">
          {phase !== 'completed' ? (
            <>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="chip-capri text-[11px] font-mono">
                    {isFollowUp ? 'Impacto funcional' : `Pergunta ${currentIndex + 1} de ${instrument.questions.length}`}
                  </span>
                  <span className="text-xs text-muted font-bold font-mono">{progressPercent}%</span>
                </div>
                <h4 className="text-lg font-bold text-ink leading-snug">{currentQuestion.statement}</h4>
                {!isFollowUp && <p className="text-xs text-muted">{instrument.instructions}</p>}
              </div>

              <div className="space-y-2.5 my-6">
                {currentQuestion.options.map((option) => {
                  const isSelected = selectedAnswers[currentQuestion.id] === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      onClick={() => handleSelectOption(option.value)}
                      aria-pressed={isSelected}
                      className={`w-full p-4 rounded-xl border text-left flex items-center justify-between text-xs font-semibold transition-all ${
                        isSelected
                          ? 'bg-primary text-white border-primary shadow-md'
                          : 'bg-canvas/50 text-ink border-line hover:border-primary/40 hover:bg-white'
                      }`}
                    >
                      <span>{option.label}</span>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold ${isSelected ? 'bg-white text-primary' : 'bg-soft text-muted'}`}>
                        {option.value}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-line">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={!isFollowUp && currentIndex === 0}
                  className="btn-ghost text-xs disabled:opacity-30"
                >
                  <ArrowLeft className="w-4 h-4" /> Anterior
                </button>
                <span className="text-[11px] text-muted">Selecione uma opção para avançar</span>
              </div>
            </>
          ) : (
            <div className="text-center space-y-5 py-4 my-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-black text-ink">Questionário concluído</h3>
                <p className="text-sm font-bold text-primary mt-2">
                  {result?.totalScore} de {instrument.maxScore} pontos • Gravidade {result?.severityLabel.toLowerCase()}
                </p>
                <p className="text-xs text-muted max-w-sm mx-auto mt-2">
                  Resultado de rastreio, não diagnóstico. Dados demonstrativos expiram em até 8 horas.
                </p>
              </div>
              {result?.hasRiskAlert && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-left">
                  <p className="text-xs font-bold text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Atenção clínica necessária
                  </p>
                  <p className="text-[11px] text-rose-700 mt-1">{result.riskAlertReason}</p>
                </div>
              )}
              <button type="button" onClick={onClose} className="btn-primary py-3 px-8 text-xs mx-auto inline-flex items-center gap-2">
                Fechar resultado <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

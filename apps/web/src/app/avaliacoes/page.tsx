'use client';

import React, { useState, useSyncExternalStore } from 'react';
import AssessmentLibrary from '@/components/assessments/AssessmentLibrary';
import LongitudinalGraph from '@/components/assessments/LongitudinalGraph';
import AiClinicalInterpreter from '@/components/assessments/AiClinicalInterpreter';
import ClinicalRiskAlertBanner from '@/components/assessments/ClinicalRiskAlertBanner';
import PatientQuizPlayer from '@/components/assessments/PatientQuizPlayer';
import AssessmentAssignmentModal from '@/components/assessments/AssessmentAssignmentModal';
import {
  AssessmentAssignment,
  AssessmentScoreResult,
  completeAssessment,
  createAssessmentAssignment,
  isSupportedAssessmentCode,
  SupportedAssessmentCode,
} from '@thats-life/core';
import { INITIAL_PATIENTS } from '@/lib/mockData';
import {
  getDemoAssessmentServerSnapshot,
  getDemoAssessmentSnapshot,
  saveDemoAssignment,
  saveDemoCompletion,
  subscribeDemoAssessments,
} from '@/lib/demoAssessmentStore';
import { ClipboardList, CheckCircle2, PlayCircle } from 'lucide-react';

export default function AvaliacoesPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isQuizPlayerOpen, setIsQuizPlayerOpen] = useState(false);
  const [activeQuizCode, setActiveQuizCode] = useState<SupportedAssessmentCode>('PHQ-9');
  const [assignmentCode, setAssignmentCode] = useState<SupportedAssessmentCode | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<AssessmentAssignment | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState(INITIAL_PATIENTS[0]?.id ?? '');
  const demoState = useSyncExternalStore(
    subscribeDemoAssessments,
    getDemoAssessmentSnapshot,
    getDemoAssessmentServerSnapshot
  );

  const createId = (prefix: string) =>
    `${prefix}_${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random()}`}`;

  const handleSendToPatient = (instrumentCode: string, channel: 'app' | 'whatsapp') => {
    if (!isSupportedAssessmentCode(instrumentCode) || channel !== 'app') {
      setToastMessage(
        `${instrumentCode} está apenas catalogado. Aplicação e envio serão liberados após validação clínica e técnica.`
      );
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    setAssignmentCode(instrumentCode);
  };

  const handleConfirmAssignment = (patientId: string) => {
    if (!assignmentCode) return;
    const assignment = createAssessmentAssignment({
      id: createId('assignment'),
      patientId,
      instrumentCode: assignmentCode,
      assignedAt: new Date().toISOString(),
    });
    saveDemoAssignment(assignment);
    setSelectedPatientId(patientId);
    setActiveAssignment(assignment);
    setActiveQuizCode(assignment.instrumentCode);
    setAssignmentCode(null);
    setIsQuizPlayerOpen(true);
    setToastMessage(`${assignment.instrumentCode} atribuído em modo demonstrativo.`);
  };

  const handleImportToSoap = () => {
    setToastMessage('Prévia copiada localmente. Nenhum prontuário foi alterado.');
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleFinishQuiz = (
    result: AssessmentScoreResult,
    answers: Record<string, number>,
    followUpAnswers: Record<string, number>
  ) => {
    if (!activeAssignment) return;
    const completed = completeAssessment({
      id: createId('response'),
      assignment: activeAssignment,
      answers,
      followUpAnswers,
      completedAt: new Date().toISOString(),
    });
    saveDemoCompletion(completed.assignment, completed.response);
    setActiveAssignment(completed.assignment);
    const pointsLabel = result.totalScore === 1 ? 'ponto' : 'pontos';
    setToastMessage(
      `Rastreio demonstrativo salvo: ${result.totalScore} ${pointsLabel}, gravidade ${result.severityLabel.toLowerCase()}.`
    );
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5" />
          <p className="text-xs font-bold">{toastMessage}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="chip-capri text-[11px] mb-1">Psicometria Clínica & Formato Quiz</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Suíte de Avaliações Psicométricas & Escalas
          </h1>
          <p className="text-xs text-muted">
            Aplicação digital pré-sessão em formato Quiz interativo com barra de progresso minimalista e correção automática.
          </p>
        </div>

        <button
          onClick={() => setAssignmentCode('PHQ-9')}
          className="btn-accent py-2.5 px-4 text-xs shadow-md flex items-center gap-2"
        >
          <PlayCircle className="w-4 h-4 text-white" />
          <span>Simular Experiência Quiz do Paciente ⚡</span>
        </button>
      </div>

      {/* Banner de Alerta Crítico de Risco (C-SSRS / PHQ-9 Item 9) */}
      <ClinicalRiskAlertBanner patients={INITIAL_PATIENTS} responses={demoState.responses} />

      {/* 1. Biblioteca Geral de 40+ Escalas (17 Domínios) */}
      <AssessmentLibrary onSendToPatient={handleSendToPatient} />

      {/* 2. Gráfico Longitudinal de Evolução & Comparação */}
      <LongitudinalGraph
        assignments={demoState.assignments}
        patients={INITIAL_PATIENTS}
        responses={demoState.responses}
        selectedPatientId={selectedPatientId}
        onSelectPatient={setSelectedPatientId}
      />

      {/* 3. Interpretação Assistida por IA */}
      <AiClinicalInterpreter onImportToSoap={handleImportToSoap} />

      {/* Player Modal de Quiz Interativo do Paciente */}
      {isQuizPlayerOpen && (
        <PatientQuizPlayer
          instrumentCode={activeQuizCode}
          onClose={() => setIsQuizPlayerOpen(false)}
          onFinishQuiz={handleFinishQuiz}
        />
      )}

      {assignmentCode && (
        <AssessmentAssignmentModal
          instrumentCode={assignmentCode}
          patients={INITIAL_PATIENTS}
          onCancel={() => setAssignmentCode(null)}
          onConfirm={handleConfirmAssignment}
        />
      )}
    </div>
  );
}

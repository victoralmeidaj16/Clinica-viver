'use client';

import React, { useState, useSyncExternalStore } from 'react';
import AssessmentLibrary from '@/components/assessments/AssessmentLibrary';
import LongitudinalGraph from '@/components/assessments/LongitudinalGraph';
import ClinicalRiskAlertBanner from '@/components/assessments/ClinicalRiskAlertBanner';
import {
  isSupportedAssessmentCode,
} from '@thats-life/core';
import { INITIAL_PATIENTS } from '@/lib/mockData';
import {
  getDemoAssessmentServerSnapshot,
  getDemoAssessmentSnapshot,
  subscribeDemoAssessments,
} from '@/lib/demoAssessmentStore';
import { ClipboardList, CheckCircle2 } from 'lucide-react';

export default function AvaliacoesPage() {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState(INITIAL_PATIENTS[0]?.id ?? '');
  const demoState = useSyncExternalStore(
    subscribeDemoAssessments,
    getDemoAssessmentSnapshot,
    getDemoAssessmentServerSnapshot
  );

  const handleSendToPatient = (instrumentCode: string) => {
    if (!isSupportedAssessmentCode(instrumentCode)) {
      setToastMessage(
        `${instrumentCode} está catalogado para referência técnica e aplicação profissional.`
      );
      setTimeout(() => setToastMessage(null), 4000);
      return;
    }

    setToastMessage(`Instrumento ${instrumentCode} selecionado para aplicação e interpretação.`);
    setTimeout(() => setToastMessage(null), 4000);
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
          <span className="chip-capri text-[11px] mb-1">Psicometria Clínica & Escalas</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-primary" />
            Suíte de Avaliações Psicométricas & Escalas
          </h1>
          <p className="text-xs text-muted">
            Catálogo completo de instrumentos psicométricos para apoio à avaliação clínica.
          </p>
        </div>
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

    </div>
  );
}

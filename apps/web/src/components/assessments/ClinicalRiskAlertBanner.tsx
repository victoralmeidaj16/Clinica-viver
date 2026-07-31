'use client';

import React from 'react';
import { getActiveRiskAlerts, type CompletedAssessment } from '@thats-life/core';
import type { Paciente } from '@/lib/mockData';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

interface ClinicalRiskAlertBannerProps {
  patients: readonly Paciente[];
  responses: readonly CompletedAssessment[];
}

export default function ClinicalRiskAlertBanner({
  patients,
  responses,
}: ClinicalRiskAlertBannerProps) {
  const alerts = getActiveRiskAlerts(responses);
  const latestAlert = alerts[0];

  if (!latestAlert) {
    return (
      <div className="card bg-emerald-50 border-emerald-200 p-4 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-700" />
        <div>
          <h3 className="text-xs font-extrabold text-emerald-900">
            Nenhum alerta clínico demonstrativo ativo
          </h3>
          <p className="text-[11px] text-emerald-800">
            Respostas positivas no item 9 do PHQ-9 serão destacadas aqui.
          </p>
        </div>
      </div>
    );
  }

  const patient = patients.find((item) => item.id === latestAlert.patientId);
  return (
    <div role="alert" className="card bg-rose-950 text-white border-coral p-5 shadow-xl space-y-3">
      <div className="flex items-center justify-between border-b border-rose-800 pb-3">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400 animate-pulse" />
          <h3 className="text-sm font-extrabold text-white">Alerta clínico ativo</h3>
        </div>
        <span className="chip bg-rose-900 text-rose-200 border-rose-700 text-[10px]">
          {alerts.length} no armazenamento local
        </span>
      </div>
      <div className="text-xs text-rose-100 bg-rose-900/40 p-3 rounded-xl border border-rose-800">
        <p className="font-bold text-white">
          {patient?.nome ?? latestAlert.patientId} • {latestAlert.instrumentCode}
        </p>
        <p className="text-[11px] text-rose-200 mt-1">{latestAlert.riskAlertReason}</p>
      </div>
      <p className="text-[10px] text-rose-300">
        Demonstração local: nenhuma notificação externa ou protocolo foi acionado automaticamente.
      </p>
    </div>
  );
}

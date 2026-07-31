'use client';

import React, { useState } from 'react';
import type { SupportedAssessmentCode } from '@thats-life/core';
import type { Paciente } from '@/lib/mockData';
import { ClipboardCheck, X } from 'lucide-react';

interface AssessmentAssignmentModalProps {
  instrumentCode: SupportedAssessmentCode;
  patients: readonly Paciente[];
  onCancel: () => void;
  onConfirm: (patientId: string) => void;
}

export default function AssessmentAssignmentModal({
  instrumentCode,
  patients,
  onCancel,
  onConfirm,
}: AssessmentAssignmentModalProps) {
  const activePatients = patients.filter((patient) => patient.status === 'ativo');
  const [patientId, setPatientId] = useState(activePatients[0]?.id ?? '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70 backdrop-blur-md">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-5 flex items-center justify-between border-b border-line">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-sm font-extrabold text-ink">Atribuir {instrumentCode}</h2>
              <p className="text-[11px] text-muted">Aplicação local em ambiente demonstrativo</p>
            </div>
          </div>
          <button type="button" onClick={onCancel} aria-label="Cancelar atribuição" className="p-1 text-muted hover:text-ink">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-ink">Paciente fictício</span>
            <select
              value={patientId}
              onChange={(event) => setPatientId(event.target.value)}
              className="input text-xs"
            >
              {activePatients.map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.nome}
                </option>
              ))}
            </select>
          </label>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-[11px] text-amber-900 leading-relaxed">
              Os dados fictícios ficam neste navegador por até 8 horas. Não use informações clínicas reais.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onCancel} className="btn-outline text-xs px-4 py-2">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!patientId}
              onClick={() => onConfirm(patientId)}
              className="btn-primary text-xs px-4 py-2 disabled:opacity-50"
            >
              Atribuir e responder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

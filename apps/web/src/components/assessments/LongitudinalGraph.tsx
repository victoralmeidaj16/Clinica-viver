'use client';

import React from 'react';
import type {
  AssessmentAssignment,
  CompletedAssessment,
} from '@thats-life/core';
import { getAssessmentInstrument } from '@thats-life/core';
import type { Paciente } from '@/lib/mockData';
import { Activity, AlertTriangle, Calendar, Clock3 } from 'lucide-react';

interface LongitudinalGraphProps {
  assignments: readonly AssessmentAssignment[];
  patients: readonly Paciente[];
  responses: readonly CompletedAssessment[];
  selectedPatientId: string;
  onSelectPatient: (patientId: string) => void;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export default function LongitudinalGraph({
  assignments,
  patients,
  responses,
  selectedPatientId,
  onSelectPatient,
}: LongitudinalGraphProps) {
  const patient = patients.find((item) => item.id === selectedPatientId);
  const patientResponses = responses
    .filter((response) => response.patientId === selectedPatientId)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const pendingAssignments = assignments.filter(
    (assignment) =>
      assignment.patientId === selectedPatientId && assignment.status === 'pending'
  );

  return (
    <div className="card space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-line pb-3">
        <div>
          <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
            <Activity className="w-5 h-5 text-capri" />
            Histórico de Aplicações
          </h2>
          <p className="text-xs text-muted">
            Resultados demonstrativos armazenados localmente por até 8 horas.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-ink">
          Paciente
          <select
            value={selectedPatientId}
            onChange={(event) => onSelectPatient(event.target.value)}
            className="input text-xs py-2 w-56"
          >
            {patients.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>
      </div>

      {pendingAssignments.length > 0 && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
          <p className="text-xs font-bold text-amber-900 flex items-center gap-2">
            <Clock3 className="w-4 h-4" />
            {pendingAssignments.length} aplicação(ões) pendente(s)
          </p>
          {pendingAssignments.map((assignment) => (
            <p key={assignment.id} className="text-[11px] text-amber-800">
              {assignment.instrumentCode} • atribuída em {formatDate(assignment.assignedAt)}
            </p>
          ))}
        </div>
      )}

      {patientResponses.length === 0 ? (
        <div className="p-8 rounded-2xl border border-dashed border-line bg-canvas text-center">
          <p className="text-sm font-bold text-ink">Nenhum resultado para {patient?.nome}</p>
          <p className="text-xs text-muted mt-1">
            Atribua um PHQ-9 ou GAD-7 e conclua o quiz para iniciar o histórico.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {(['PHQ-9', 'GAD-7'] as const).map((code) => {
            const instrument = getAssessmentInstrument(code)!;
            const series = patientResponses.filter(
              (response) => response.instrumentCode === code
            );
            if (series.length === 0) return null;

            return (
              <div key={code} className="p-4 rounded-2xl bg-canvas border border-line space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span>{instrument.title}</span>
                  <span className="text-primary">{series.length} aplicação(ões)</span>
                </div>
                <div className="space-y-2">
                  {series.map((response) => (
                    <div key={response.id} className="grid grid-cols-[105px_1fr_68px] items-center gap-3">
                      <span className="text-[10px] text-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(response.completedAt)}
                      </span>
                      <div className="h-5 bg-white border border-line rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${response.hasRiskAlert ? 'bg-rose-500' : 'bg-primary'}`}
                          style={{
                            width: `${Math.max(
                              4,
                              (response.totalScore / instrument.maxScore) * 100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-bold text-ink text-right">
                        {response.totalScore}/{instrument.maxScore}
                      </span>
                      <span className="col-start-2 col-span-2 text-[10px] text-muted">
                        Gravidade {response.severityLabel.toLowerCase()}
                        {response.hasRiskAlert && (
                          <span className="text-rose-700 font-bold inline-flex items-center gap-1 ml-2">
                            <AlertTriangle className="w-3 h-3" /> alerta de risco
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

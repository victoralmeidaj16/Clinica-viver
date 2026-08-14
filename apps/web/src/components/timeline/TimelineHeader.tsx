import React from 'react';
import { FileText, User } from 'lucide-react';

export interface TimelinePatientOption {
  id: string;
  displayName: string;
}

interface TimelineHeaderProps {
  selectedPatientId: string;
  onSelectPatient: (id: string) => void;
  patients: readonly TimelinePatientOption[];
  entriesCount?: number;
}

export default function TimelineHeader({
  selectedPatientId,
  onSelectPatient,
  patients,
}: TimelineHeaderProps) {
  const selectedPatient =
    patients.find((p) => p.id === selectedPatientId) ?? patients[0];

  return (
    <header className="relative overflow-hidden rounded-3xl bg-psi-darkest px-6 py-6 text-white shadow-contrast sm:px-8 border border-white/10">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative space-y-4">
        {/* Top Controls: Seletor de Paciente Apenas */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5 bg-white/10 px-4 py-2 rounded-2xl border border-white/15">
            <User className="w-4 h-4 text-psi-vibrant" />
            <span className="text-[11px] uppercase font-bold text-psi-vibrant tracking-wider">
              Paciente Selecionado:
            </span>
            <select
              value={selectedPatientId}
              onChange={(e) => onSelectPatient(e.target.value)}
              className="bg-transparent text-xs font-black text-white focus:outline-none cursor-pointer"
            >
              {patients.map((patient) => (
                <option key={patient.id} value={patient.id} className="text-ink font-bold">
                  {patient.displayName}
                </option>
              ))}
            </select>
          </div>

          <span className="text-xs text-slate-300 font-medium">
            Seus Pacientes em Acompanhamento
          </span>
        </div>

        {/* Título e Texto Limpos do Card Hero */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-psi-vibrant">
            <FileText className="h-4 w-4" />
            Prontuário Clínico do Paciente
          </div>

          <h1 className="font-serif text-2xl font-bold text-white">
            {selectedPatient?.displayName ?? 'Paciente'}
          </h1>

          <p className="text-xs text-slate-300">
            Histórico completo de evoluções, anotações e acompanhamento clínico.
          </p>
        </div>
      </div>
    </header>
  );
}

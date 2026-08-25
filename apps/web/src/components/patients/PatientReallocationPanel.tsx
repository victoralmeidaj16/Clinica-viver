'use client';

import { useState } from 'react';
import { ArrowRight, UserRoundCheck } from 'lucide-react';
import type { ManagedPatient } from './managementTypes';

interface Props {
  patient: ManagedPatient;
  saving: boolean;
  onAllocate: (psychologistId: string) => void;
}

export default function PatientReallocationPanel({ patient, saving, onAllocate }: Props) {
  const [psychologistId, setPsychologistId] = useState('');
  const candidates = patient.psicologosCompativeis ?? [];

  if (!patient.patientId) {
    return <Notice>Esta solicitação ainda não virou paciente e não pode ser reativada por este fluxo.</Notice>;
  }

  if (candidates.length === 0) {
    return (
      <Notice>
        {patient.desistencia?.permitirTrocaPsicologo
          ? 'Não há profissional com vaga compatível com o serviço, a modalidade e o perfil solicitado.'
          : 'O profissional anterior não está disponível, e o paciente não autorizou a troca de psicólogo.'}
      </Notice>
    );
  }

  const selected = candidates.find((item) => item.id === psychologistId);

  return (
    <div className="rounded-2xl border border-psi-vibrant/20 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-psi-vibrant/10 text-psi-vibrant">
          <UserRoundCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-black text-ink">Nova alocação</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            A lista já considera serviço, modalidade, turno, demanda e vagas disponíveis.
          </p>
        </div>
      </div>

      <label className="mt-4 block text-xs font-bold text-ink">
        Profissional disponível
        <select
          value={psychologistId}
          onChange={(event) => setPsychologistId(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs font-medium text-ink focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20"
        >
          <option value="">Selecione o psicólogo</option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.nome} · {candidate.pacientesAtivos}/{candidate.limitePacientes} pacientes
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <p className="mt-3 rounded-xl bg-psi-soft/40 px-3 py-2 text-[11px] font-semibold text-muted">
          {patient.servicoNome ?? patient.servicoKey ?? 'Serviço informado'}
          {' · '}{patient.modalidade ?? 'Modalidade informada'}
          {' · '}{selected.limitePacientes - selected.pacientesAtivos} vaga(s) antes desta alocação
        </p>
      )}

      <button
        type="button"
        disabled={saving || !psychologistId}
        onClick={() => onAllocate(psychologistId)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-psi-vibrant py-3 text-xs font-black text-white transition-colors hover:bg-psi-vibrant/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? 'Alocando…' : 'Alocar paciente'}
        {!saving && <ArrowRight className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] font-semibold leading-relaxed text-amber-800">
      {children}
    </p>
  );
}

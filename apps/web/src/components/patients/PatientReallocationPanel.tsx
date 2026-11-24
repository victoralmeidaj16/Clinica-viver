'use client';

import { useState } from 'react';
import { ArrowRight, UserRoundCheck } from 'lucide-react';
import type { AllocationMode, ManagedPatient, ReassignOptions } from './managementTypes';

interface Props {
  patient: ManagedPatient;
  saving: boolean;
  onAllocate: (psychologistId: string, options?: ReassignOptions) => void;
}

export default function PatientReallocationPanel({ patient, saving, onAllocate }: Props) {
  const [psychologistId, setPsychologistId] = useState('');
  const [modo, setModo] = useState<AllocationMode>('VINCULAR_DIRETO');
  const [excederLimite, setExcederLimite] = useState(false);
  const [justificativaExcesso, setJustificativaExcesso] = useState('');
  const candidates = patient.psicologosCompativeis ?? [];

  if (!patient.patientId) {
    return <Notice>Esta solicitação ainda não virou paciente e não pode ser reativada por este fluxo.</Notice>;
  }

  if (candidates.length === 0) {
    return (
      <Notice>
        {patient.desistencia?.permitirTrocaPsicologo
          ? 'Não há profissional compatível com o serviço, a modalidade e o perfil solicitado.'
          : 'O profissional anterior não está disponível, e o paciente não autorizou a troca de psicólogo.'}
      </Notice>
    );
  }

  const selected = candidates.find((item) => item.id === psychologistId);
  const lotado = Boolean(selected && (selected.lotado || selected.pacientesAtivos >= selected.limitePacientes));
  const bloqueadoPorLimite = lotado && (!excederLimite || !justificativaExcesso.trim());

  return (
    <div className="rounded-2xl border border-psi-vibrant/20 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-psi-vibrant/10 text-psi-vibrant">
          <UserRoundCheck className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs font-black text-ink">Nova alocação</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
            A lista considera serviço, modalidade, turno, demanda e ocupação atual.
          </p>
        </div>
      </div>

      <label className="mt-4 block text-xs font-bold text-ink">
        Profissional compatível
        <select
          value={psychologistId}
          onChange={(event) => {
            setPsychologistId(event.target.value);
            setExcederLimite(false);
          }}
          className="mt-1.5 w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs font-medium text-ink focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20"
        >
          <option value="">Selecione o psicólogo</option>
          {candidates.map((candidate) => {
            const full = candidate.lotado || candidate.pacientesAtivos >= candidate.limitePacientes;
            return (
              <option key={candidate.id} value={candidate.id}>
                {candidate.nome} · {candidate.pacientesAtivos}/{candidate.limitePacientes} pacientes
                {full ? ' (lotado)' : ''}
              </option>
            );
          })}
        </select>
      </label>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {([
          ['VINCULAR_DIRETO', 'Vincular diretamente', 'Ativa o vínculo e avisa o paciente no WhatsApp.'],
          ['PEDIR_ACEITE', 'Pedir aceite (24h)', 'Envia oferta para o profissional confirmar.'],
        ] as const).map(([valor, titulo, desc]) => (
          <label
            key={valor}
            className={`cursor-pointer rounded-xl border p-2.5 text-xs transition-colors ${
              modo === valor ? 'border-psi-vibrant bg-psi-soft/20' : 'border-psi-soft bg-white'
            }`}
          >
            <span className="flex items-center gap-2 font-bold text-ink">
              <input
                type="radio"
                name={`realocacao-modo-${patient.id}`}
                checked={modo === valor}
                onChange={() => setModo(valor)}
                className="accent-psi-vibrant"
              />
              {titulo}
            </span>
            <span className="mt-1 block text-[10px] leading-snug text-muted">{desc}</span>
          </label>
        ))}
      </div>

      {selected && (
        <p className="mt-3 rounded-xl bg-psi-soft/40 px-3 py-2 text-[11px] font-semibold text-muted">
          {patient.servicoNome ?? patient.servicoKey ?? 'Serviço informado'}
          {' · '}{patient.modalidade ?? 'Modalidade informada'}
          {' · '}{Math.max(0, selected.limitePacientes - selected.pacientesAtivos)} vaga(s) livre(s)
        </p>
      )}

      {selected && lotado && (
        <div className="mt-3 space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
          <p className="font-bold">
            Limite atingido ({selected.pacientesAtivos} de {selected.limitePacientes} pacientes).
          </p>
          <label className="flex cursor-pointer items-center gap-2 font-semibold">
            <input
              type="checkbox"
              checked={excederLimite}
              onChange={(event) => setExcederLimite(event.target.checked)}
              className="accent-amber-700"
            />
            <span>Autorizar exceção ({selected.pacientesAtivos + 1} de {selected.limitePacientes})</span>
          </label>
          {excederLimite && (
            <input
              type="text"
              value={justificativaExcesso}
              onChange={(event) => setJustificativaExcesso(event.target.value)}
              placeholder="Justificativa obrigatória para exceder o limite"
              maxLength={300}
              className="w-full rounded-lg border border-amber-400/60 bg-white px-2.5 py-2 text-xs text-ink focus:outline-none"
            />
          )}
        </div>
      )}

      <button
        type="button"
        disabled={saving || !psychologistId || bloqueadoPorLimite}
        onClick={() =>
          onAllocate(psychologistId, {
            modo,
            ...(lotado ? { excederLimite, justificativaExcesso: justificativaExcesso.trim() } : {}),
          })
        }
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-psi-vibrant py-3 text-xs font-black text-white transition-colors hover:bg-psi-vibrant/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? 'Alocando…' : modo === 'PEDIR_ACEITE' ? 'Enviar oferta de aceite' : 'Alocar paciente'}
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

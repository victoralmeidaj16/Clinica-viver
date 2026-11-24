'use client';

import { useState } from 'react';
import { UserRoundCog } from 'lucide-react';
import type {
  AllocationMode,
  ManagedPatient,
  ManagedPsychologist,
  ReassignOptions,
} from './managementTypes';

interface Props {
  patient: ManagedPatient;
  psychologists: readonly ManagedPsychologist[];
  onReassign: (
    patient: ManagedPatient,
    professionalId: string,
    reason: string,
    options?: ReassignOptions,
  ) => Promise<void>;
}

export default function PatientReassignPanel({ patient, psychologists, onReassign }: Props) {
  const [professionalId, setProfessionalId] = useState(patient.psicologoId ?? '');
  const [reason, setReason] = useState('');
  const [modo, setModo] = useState<AllocationMode>('PEDIR_ACEITE');
  const [excederLimite, setExcederLimite] = useState(false);
  const [justificativaExcesso, setJustificativaExcesso] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isLead = !patient.patientId && Boolean(patient.leadId);
  const selected = psychologists.find((item) => item.id === professionalId);
  const ativos = selected?.pacientesAtivos ?? 0;
  const limite = selected?.limitePacientes ?? 5;
  const lotado = isLead && Boolean(selected) && !patient.patientId && ativos >= limite;

  const precisaJustificativa = lotado && (!excederLimite || !justificativaExcesso.trim());

  const submit = async () => {
    if ((!patient.patientId && !patient.leadId) || !professionalId || !reason.trim() || precisaJustificativa) {
      return;
    }
    setSaving(true);
    setError('');
    try {
      const options: ReassignOptions | undefined = isLead
        ? {
            modo,
            ...(lotado ? { excederLimite, justificativaExcesso: justificativaExcesso.trim() } : {}),
          }
        : undefined;
      await onReassign(patient, professionalId, reason.trim(), options);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao encaminhar paciente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-psi-soft bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <UserRoundCog className="h-4 w-4 text-psi-vibrant" />
        <h3 className="text-sm font-black text-ink">Encaminhar para psicólogo</h3>
      </div>
      {!patient.patientId && !patient.leadId ? (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs font-semibold text-amber-800">
          Não foi possível identificar a triagem ou o cadastro deste paciente para encaminhamento.
        </p>
      ) : (
        <div className="space-y-3">
          <select
            value={professionalId}
            onChange={(event) => {
              setProfessionalId(event.target.value);
              setExcederLimite(false);
            }}
            className="w-full rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs font-medium text-ink focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20"
          >
            <option value="">Selecione o novo responsável</option>
            {psychologists.map((psychologist) => {
              const info = psychologist.limitePacientes !== undefined
                ? ` · ${psychologist.pacientesAtivos ?? 0}/${psychologist.limitePacientes}`
                : '';
              return (
                <option key={psychologist.id} value={psychologist.id}>
                  {psychologist.nome}{info}
                </option>
              );
            })}
          </select>

          {isLead && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {([
                ['PEDIR_ACEITE', 'Pedir aceite (24h)', 'Envia oferta para o psicólogo confirmar.'],
                ['VINCULAR_DIRETO', 'Vincular diretamente', 'Confirma o vínculo e avisa o paciente na hora.'],
              ] as const).map(([valor, titulo, desc]) => (
                <label
                  key={valor}
                  className={`cursor-pointer rounded-xl border p-2.5 text-xs transition-colors ${
                    modo === valor
                      ? 'border-psi-vibrant bg-white text-ink shadow-xs'
                      : 'border-psi-soft bg-white/60 text-muted'
                  }`}
                >
                  <span className="flex items-center gap-2 font-bold text-ink">
                    <input
                      type="radio"
                      name={`modo-${patient.id}`}
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
          )}

          {lotado && (
            <div className="space-y-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900">
              <p className="font-bold">
                Profissional lotado ({ativos} de {limite} pacientes).
              </p>
              <label className="flex cursor-pointer items-center gap-2 font-semibold">
                <input
                  type="checkbox"
                  checked={excederLimite}
                  onChange={(event) => setExcederLimite(event.target.checked)}
                  className="accent-amber-700"
                />
                <span>Autorizar exceder o limite ({ativos + 1} de {limite})</span>
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

          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo obrigatório da troca"
            rows={3}
            className="w-full resize-none rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs font-medium text-ink focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20"
          />
          {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={saving || !professionalId || !reason.trim() || precisaJustificativa}
            className="btn-primary w-full rounded-xl py-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? 'Registrando encaminhamento…' : 'Confirmar encaminhamento'}
          </button>
        </div>
      )}
    </section>
  );
}


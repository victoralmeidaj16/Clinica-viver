'use client';

import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Layers,
  Loader2,
  UserRound,
  X,
} from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import {
  CLINICAL_SERVICES,
  getServiceDuration,
  clinicDateTimeToIso,
  manualAppointmentTimes,
  todayAtClinic,
  type ManualAppointmentMode,
} from '@/lib/manualAppointment';
import { FUSO_CLINICA } from '@/lib/sessionReference';

export interface ManualAppointmentPatient {
  id: string;
  displayName: string;
  status: string;
}

interface Props {
  patients: readonly ManualAppointmentPatient[];
  initialPatientId?: string;
  onClose: () => void;
  onScheduled?: () => void | Promise<void>;
}

const MODES: Array<{ value: ManualAppointmentMode; label: string }> = [
  { value: 'video', label: 'Online' },
  { value: 'in_person', label: 'Presencial' },
  { value: 'phone', label: 'Telefone' },
];

export function ManualAppointmentDialog({ patients, initialPatientId, onClose, onScheduled }: Props) {
  const eligible = useMemo(
    () =>
      patients
        .filter((patient) => patient.status !== 'discharged')
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')),
    [patients]
  );

  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [serviceKey, setServiceKey] = useState<string>('PSICOTERAPIA');
  const [date, setDate] = useState(() => todayAtClinic());
  const [time, setTime] = useState('14:00');
  const [mode, setMode] = useState<ManualAppointmentMode>('video');
  const [chargeDueDate, setChargeDueDate] = useState(() => todayAtClinic());
  const [chargeDueTime, setChargeDueTime] = useState('14:00');
  const [customDue, setCustomDue] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success'; text: string }>();

  const durationMinutes = getServiceDuration(serviceKey);
  const selectedService = CLINICAL_SERVICES.find((s) => s.key === serviceKey) ?? CLINICAL_SERVICES[0];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(undefined);
    if (!patientId) {
      setMessage({ kind: 'error', text: 'Selecione um paciente para continuar.' });
      return;
    }
    setSaving(true);
    try {
      const { startsAt, endsAt } = manualAppointmentTimes({ date, time, durationMinutes });
      const chargeDueAt = clinicDateTimeToIso(chargeDueDate, chargeDueTime);
      await applicationRequest('/appointments', {
        method: 'POST',
        headers: commandHeaders(),
        body: JSON.stringify({
          id: `appointment-manual-${crypto.randomUUID()}`,
          patientId,
          startsAt,
          endsAt,
          timezone: FUSO_CLINICA,
          mode,
          createdAt: new Date().toISOString(),
          chargeDueAt,
        }),
      });
      setMessage({ kind: 'success', text: 'Sessão adicionada à agenda e ao sino do profissional.' });
      await onScheduled?.();
    } catch (error) {
      setMessage({
        kind: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível criar o agendamento.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="manual-appointment-title" className="w-full max-w-xl overflow-hidden rounded-t-[2rem] border border-white/10 bg-white shadow-2xl sm:rounded-[2rem]">
        <header className="relative overflow-hidden bg-psi-darkest px-5 py-6 text-white sm:px-7">
          <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full border-[28px] border-psi-vibrant/15" />
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <span className="rounded-2xl bg-psi-vibrant p-3 shadow-lg shadow-psi-vibrant/20">
                <CalendarPlus className="h-5 w-5" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.22em] text-psi-vibrant">Agenda clínica</p>
                <h2 id="manual-appointment-title" className="mt-1 text-xl font-extrabold">Novo agendamento</h2>
                <p className="mt-1 text-xs text-psi-soft/75">Registre o horário combinado diretamente com o paciente.</p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-psi-soft hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <form onSubmit={submit} className="space-y-5 p-5 sm:p-7">
          {message && (
            <div role="status" className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
              {message.kind === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
              {message.text}
            </div>
          )}

          <label className="block text-xs font-bold text-ink">
            Paciente *
            <span className="relative mt-1.5 block">
              <UserRound className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
              <select
                required
                value={patientId}
                onChange={(event) => setPatientId(event.target.value)}
                disabled={Boolean(initialPatientId) || saving || message?.kind === 'success'}
                className="input w-full appearance-none py-3 pl-10 pr-10 text-xs font-bold"
              >
                <option value="">Selecione um paciente</option>
                {eligible.map((patient) => (
                  <option key={patient.id} value={patient.id}>{patient.displayName}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-muted" />
            </span>
          </label>

          <label className="block text-xs font-bold text-ink">
            Serviço *
            <span className="relative mt-1.5 block">
              <Layers className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-muted" />
              <select
                required
                value={serviceKey}
                onChange={(event) => setServiceKey(event.target.value)}
                disabled={saving || message?.kind === 'success'}
                className="input w-full appearance-none py-3 pl-10 pr-10 text-xs font-bold"
              >
                {CLINICAL_SERVICES.map((servico) => (
                  <option key={servico.key} value={servico.key}>
                    {servico.label} ({servico.durationMinutes} min)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-muted" />
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-ink">
              Data *
              <input type="date" required min={todayAtClinic()} value={date} onChange={(event) => { const value = event.target.value; setDate(value); if (!customDue) setChargeDueDate(value); }} disabled={saving || message?.kind === 'success'} className="input mt-1.5 py-3 text-xs font-bold" />
            </label>
            <label className="text-xs font-bold text-ink">
              Horário de início *
              <input type="time" required value={time} onChange={(event) => { const value = event.target.value; setTime(value); if (!customDue) setChargeDueTime(value); }} disabled={saving || message?.kind === 'success'} className="input mt-1.5 py-3 text-xs font-bold" />
            </label>
          </div>

          <fieldset disabled={saving || message?.kind === 'success'} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <legend className="px-2 text-xs font-black text-amber-950">Vencimento da cobrança</legend>
            <p className="mb-3 text-[11px] text-amber-800">O link e o Pix serão encerrados neste horário exato.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-ink">Data *<input type="date" required min={todayAtClinic()} value={chargeDueDate} onChange={(event) => { setCustomDue(true); setChargeDueDate(event.target.value); }} className="input mt-1.5 py-3 text-xs font-bold" /></label>
              <label className="text-xs font-bold text-ink">Horário *<input type="time" required value={chargeDueTime} onChange={(event) => { setCustomDue(true); setChargeDueTime(event.target.value); }} className="input mt-1.5 py-3 text-xs font-bold" /></label>
            </div>
          </fieldset>

          <fieldset disabled={saving || message?.kind === 'success'}>
            <legend className="text-xs font-bold text-ink">Modalidade</legend>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {MODES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setMode(item.value)}
                  className={`rounded-xl border px-2 py-3 text-[11px] font-extrabold transition ${mode === item.value ? 'border-psi-vibrant bg-psi-vibrant text-white shadow-md shadow-psi-vibrant/15' : 'border-line bg-slate-50 text-muted hover:border-psi-vibrant/40 hover:text-ink'}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </fieldset>

          <p className="rounded-2xl border border-psi-soft bg-psi-light/60 px-4 py-3 text-[11px] leading-relaxed text-psi-deep">
            O horário será registrado em Brasília com duração de <strong>{durationMinutes} min</strong> ({selectedService.label}). Receberá link exclusivo de pagamento e aparecerá nas notificações do sino.
          </p>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-outline flex-1 justify-center py-3 text-xs">
              {message?.kind === 'success' ? 'Concluir' : 'Cancelar'}
            </button>
            {message?.kind !== 'success' && (
              <button type="submit" disabled={saving || eligible.length === 0} className="btn-accent flex-1 justify-center py-3 text-xs disabled:opacity-50">
                {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : <><CalendarPlus className="h-4 w-4" /> Agendar sessão</>}
              </button>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}


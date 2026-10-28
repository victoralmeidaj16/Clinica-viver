'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Clock3,
  UserRound,
} from 'lucide-react';
import { useManualAppointmentSubmission } from './useManualAppointmentSubmission';
import { AppointmentFrequencyField } from './AppointmentFrequencyField';
import { variableDurationMinutes } from './VariableDurationFields';
import { ManualAppointmentServiceFields } from './ManualAppointmentServiceFields';
import { ManualAppointmentHeader } from './ManualAppointmentHeader';
import { ManualAppointmentActions } from './ManualAppointmentActions';
import {
  CLINICAL_SERVICES,
  getServiceDuration,
  hasVariableDuration,
  monthlyRecurrenceDates,
  todayAtClinic,
  type AppointmentFrequency,
  type ManualAppointmentMode,
} from '@/lib/manualAppointment';

export interface ManualAppointmentPatient {
  id: string;
  displayName: string;
  status: string;
  primaryProfessionalId?: string;
  professionalName?: string;
}

interface Props {
  patients: readonly ManualAppointmentPatient[];
  servicosHabilitados?: readonly string[];
  initialPatientId?: string;
  adminMode?: boolean;
  onClose: () => void;
  onScheduled?: () => void | Promise<void>;
}

const MODES: Array<{ value: ManualAppointmentMode; label: string }> = [
  { value: 'video', label: 'Online' },
  { value: 'in_person', label: 'Presencial' },
];

type DurationPreset = 50 | 90 | 'manual';

export function ManualAppointmentDialog({
  patients,
  servicosHabilitados = [],
  initialPatientId,
  adminMode = false,
  onClose,
  onScheduled,
}: Props) {
  const eligible = useMemo(
    () =>
      patients
        .filter((patient) => patient.status !== 'discharged')
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR')),
    [patients]
  );

  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const selectedPatient = useMemo(
    () => eligible.find((p) => p.id === patientId),
    [eligible, patientId]
  );
  const servicosDisponiveis = useMemo(
    () => servicosHabilitados.length === 0
      ? CLINICAL_SERVICES
      : CLINICAL_SERVICES.filter((servico) => servicosHabilitados.includes(servico.key)),
    [servicosHabilitados]
  );
  const [serviceKey, setServiceKey] = useState<string>(() =>
    servicosHabilitados.length > 0 && !servicosHabilitados.includes('PSICOTERAPIA')
      ? servicosHabilitados[0]
      : 'PSICOTERAPIA'
  );
  const [durationPreset, setDurationPreset] = useState<DurationPreset>(50);
  const [customHours, setCustomHours] = useState('');
  const [customMinutes, setCustomMinutes] = useState('');
  const [date, setDate] = useState(() => todayAtClinic());
  const [time, setTime] = useState('14:00');
  const [frequency, setFrequency] = useState<AppointmentFrequency>('weekly');
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [mode, setMode] = useState<ManualAppointmentMode>('video');
  const [chargeDueDate, setChargeDueDate] = useState(() => todayAtClinic());
  const [chargeDueTime, setChargeDueTime] = useState('14:00');
  const [customDue, setCustomDue] = useState(false);

  const variableDuration = hasVariableDuration(serviceKey);
  const manualDuration = variableDuration && durationPreset === 'manual';
  const selectedEvaluationDuration = durationPreset === 'manual'
    ? variableDurationMinutes(customHours, customMinutes)
    : durationPreset;
  const durationMinutes = variableDuration
    ? selectedEvaluationDuration
    : getServiceDuration(serviceKey);
  const validDuration = Number.isInteger(durationMinutes) && durationMinutes >= 15 && durationMinutes <= 240;
  const selectedService = CLINICAL_SERVICES.find((s) => s.key === serviceKey) ?? CLINICAL_SERVICES[0];
  const recurrenceDates = useMemo(() => frequency === 'custom' ? customDates : monthlyRecurrenceDates(date, frequency), [date, frequency, customDates]);

  const { submit, saving, message, completed } = useManualAppointmentSubmission({
    patientId, professionalId: selectedPatient?.primaryProfessionalId, adminMode, recurrenceDates, date, time,
    durationMinutes, validDuration, chargeDueDate, chargeDueTime, mode, serviceKey, onScheduled,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <section role="dialog" aria-modal="true" aria-labelledby="manual-appointment-title" className="flex max-h-[calc(100dvh-1rem)] w-full max-w-xl flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[2rem]">
        <ManualAppointmentHeader onClose={onClose} />

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 sm:px-6">
          {message && (
            <div role="status" className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold ${message.kind === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : message.kind === 'warning' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
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
                disabled={Boolean(initialPatientId) || saving || completed}
                className="input w-full appearance-none py-3 pl-10 pr-10 text-xs font-bold"
              >
                <option value="">Selecione um paciente</option>
                {eligible.map((patient) => (
                  <option
                    key={patient.id}
                    value={patient.id}
                    disabled={adminMode && !patient.primaryProfessionalId}
                  >
                    {patient.displayName}
                    {patient.professionalName
                      ? ` — Psicólogo: ${patient.professionalName}`
                      : adminMode
                        ? ' — (Sem psicólogo atribuído)'
                        : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-3.5 h-4 w-4 text-muted" />
            </span>
          </label>

          {selectedPatient?.professionalName && (
            <div className="flex items-center gap-2 rounded-xl border border-psi-soft bg-psi-light/60 px-3.5 py-2.5 text-xs font-semibold text-psi-deep">
              <UserRound className="h-4 w-4 shrink-0 text-psi-vibrant" />
              <span>Psicólogo atribuído: <strong>{selectedPatient.professionalName}</strong></span>
            </div>
          )}

          {adminMode && selectedPatient && !selectedPatient.primaryProfessionalId && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
              Este paciente ainda não possui um psicólogo atribuído. Atribua um psicólogo no cadastro do paciente antes de agendar.
            </div>
          )}

          <ManualAppointmentServiceFields services={servicosDisponiveis} serviceKey={serviceKey}
            onServiceChange={(value) => { setServiceKey(value); setDurationPreset(50); setCustomHours(''); setCustomMinutes(''); }}
            variableDuration={variableDuration} manualDuration={manualDuration} durationPreset={durationPreset}
            setDurationPreset={setDurationPreset} customHours={customHours} customMinutes={customMinutes}
            setCustomHours={setCustomHours} setCustomMinutes={setCustomMinutes} disabled={saving || completed} />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-bold text-ink">
              Data *
              <input type="date" required min={todayAtClinic()} value={date} onChange={(event) => { const value = event.target.value; setDate(value); if (!customDue) setChargeDueDate(value); }} disabled={saving || completed} className="input mt-1.5 py-3 text-xs font-bold" />
            </label>
            <label className="text-xs font-bold text-ink">
              Horário de início *
              <input type="time" required value={time} onChange={(event) => { const value = event.target.value; setTime(value); if (!customDue) setChargeDueTime(value); }} disabled={saving || completed} className="input mt-1.5 py-3 text-xs font-bold" />
            </label>
          </div>

          <AppointmentFrequencyField
            value={frequency}
            initialDate={date}
            dates={recurrenceDates}
            time={time}
            disabled={saving || completed}
            onChange={(value) => { setFrequency(value); if (value === 'custom' && !customDates.length && date) setCustomDates([date]); }}
            onDatesChange={setCustomDates}
          />

          <fieldset disabled={saving || completed} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
            <legend className="px-2 text-xs font-black text-amber-950">Vencimento da cobrança</legend>
            <p className="mb-3 text-[11px] text-amber-800">O link e o Pix serão encerrados neste horário exato.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-bold text-ink">Data *<input type="date" required min={todayAtClinic()} value={chargeDueDate} onChange={(event) => { setCustomDue(true); setChargeDueDate(event.target.value); }} className="input mt-1.5 py-3 text-xs font-bold" /></label>
              <label className="text-xs font-bold text-ink">Horário *<input type="time" required value={chargeDueTime} onChange={(event) => { setCustomDue(true); setChargeDueTime(event.target.value); }} className="input mt-1.5 py-3 text-xs font-bold" /></label>
            </div>
          </fieldset>

          <fieldset disabled={saving || completed}>
            <legend className="text-xs font-bold text-ink">Modalidade</legend>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
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
            Os horários serão registrados em Brasília com duração de <strong>{validDuration ? `${durationMinutes} min` : 'a definir'}</strong> ({selectedService.label}). Cada sessão receberá sua própria cobrança e aparecerá nas notificações do sino.
          </p>
          </div>

          <ManualAppointmentActions
            success={completed}
            saving={saving}
            disabled={
              saving ||
              eligible.length === 0 ||
              recurrenceDates.length === 0 ||
              (adminMode && (!selectedPatient || !selectedPatient.primaryProfessionalId))
            }
            count={recurrenceDates.length}
            onClose={onClose}
          />
        </form>
      </section>
    </div>
  );
}

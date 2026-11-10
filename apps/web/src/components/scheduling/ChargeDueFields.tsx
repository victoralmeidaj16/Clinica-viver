'use client';

import { isFutureChargeDueAt } from '@/lib/chargeDue';
import { clinicDateTimeToIso, todayAtClinic } from '@/lib/manualAppointment';

/** Data e hora do vencimento no fuso da clínica, no formato dos campos do formulário. */
export function chargeDueFieldValues(iso: string): { date: string; time: string } {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

/** Converte os campos para ISO e aplica a mesma regra do servidor: o prazo fica no futuro. */
export function futureChargeDueIso(date: string, time: string): string {
  const dueAt = clinicDateTimeToIso(date, time);
  if (!isFutureChargeDueAt(dueAt)) throw new Error('O vencimento deve estar no futuro.');
  return dueAt;
}

/** Campos de data e horário do vencimento, comuns à agenda, à gestão e ao financeiro. */
export function ChargeDueFields({ date, time, disabled, onDateChange, onTimeChange,
  labelClassName = 'text-xs font-bold text-ink', inputClassName = 'input mt-1 w-full' }: {
  date: string; time: string; disabled?: boolean;
  onDateChange: (value: string) => void; onTimeChange: (value: string) => void;
  labelClassName?: string; inputClassName?: string;
}) {
  return <div className="grid grid-cols-2 gap-3">
    <label className={labelClassName}>Data do vencimento
      <input required type="date" min={todayAtClinic()} value={date} disabled={disabled}
        onChange={(event) => onDateChange(event.target.value)} className={inputClassName} /></label>
    <label className={labelClassName}>Horário do vencimento
      <input required type="time" value={time} disabled={disabled}
        onChange={(event) => onTimeChange(event.target.value)} className={inputClassName} /></label>
  </div>;
}

'use client';

import { CreditCard } from 'lucide-react';
import { todayAtClinic } from '@/lib/manualAppointment';
import type { CusteioAoAgendar } from '@/lib/sessionChargeRules';

interface Props {
  custeio?: CusteioAoAgendar;
  convenioNome?: string;
  date: string;
  time: string;
  disabled: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
}

export function ManualAppointmentChargeDue({ custeio, convenioNome, date, time, disabled, onDateChange, onTimeChange }: Props) {
  if (custeio === 'empresa') {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
        <CreditCard className="h-4 w-4 shrink-0" />
        Custeado por {convenioNome ?? 'empresa'} - sem cobrança ao paciente.
      </p>
    );
  }

  return (
    <fieldset disabled={disabled} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
      <legend className="px-2 text-xs font-black text-amber-950">Vencimento da cobrança</legend>
      <p className="mb-3 text-[11px] text-amber-800">
        {custeio === 'empresa_com_limite' && `${convenioNome ?? 'A empresa'} custeia as sessões até o limite do convênio. Este vencimento só vale para as sessões cobradas do paciente. `}
        O link e o Pix serão encerrados neste horário exato.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-ink">Data *<input type="date" required min={todayAtClinic()} value={date} onChange={(event) => onDateChange(event.target.value)} className="input mt-1.5 py-3 text-xs font-bold" /></label>
        <label className="text-xs font-bold text-ink">Horário *<input type="time" required value={time} onChange={(event) => onTimeChange(event.target.value)} className="input mt-1.5 py-3 text-xs font-bold" /></label>
      </div>
    </fieldset>
  );
}

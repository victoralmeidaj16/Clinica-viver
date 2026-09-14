'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  initialDate: string;
  minDate: string;
  dates: readonly string[];
  onChange: (dates: string[]) => void;
}

export function AppointmentDatesCalendar({ initialDate, minDate, dates, onChange }: Props) {
  const [month, setMonth] = useState(() => (initialDate || minDate).slice(0, 7));
  const [year, number] = month.split('-').map(Number);
  const first = new Date(year, number - 1, 1);
  const days = new Date(year, number, 0).getDate();
  const move = (offset: number) => {
    const next = new Date(year, number - 1 + offset, 1);
    setMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  };
  return (
    <div className="mt-3 rounded-xl border border-line p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Mês anterior" onClick={() => move(-1)} className="rounded-lg p-2 hover:bg-psi-light"><ChevronLeft className="h-4 w-4" /></button>
        <p aria-live="polite" className="text-xs font-bold capitalize">{first.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</p>
        <button type="button" aria-label="Próximo mês" onClick={() => move(1)} className="rounded-lg p-2 hover:bg-psi-light"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <p className="mb-2 text-[11px] text-muted">Selecione ou desmarque os dias das sessões.</p>
      <div className="grid grid-cols-7 gap-1">
        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => <span key={day} className="text-center text-[10px] font-bold text-muted">{day}</span>)}
        {Array.from({ length: first.getDay() }, (_, i) => <span key={`blank-${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const day = `${month}-${String(i + 1).padStart(2, '0')}`;
          const selected = dates.includes(day);
          return <button key={day} type="button" disabled={day < minDate} aria-pressed={selected}
            aria-label={new Date(year, number - 1, i + 1).toLocaleDateString('pt-BR')}
            onClick={() => onChange(selected ? dates.filter(value => value !== day) : [...dates, day].sort())}
            className={`min-h-9 rounded-lg text-xs font-bold disabled:opacity-30 ${selected ? 'bg-psi-vibrant text-white' : 'hover:bg-psi-light'}`}>{i + 1}</button>;
        })}
      </div>
    </div>
  );
}

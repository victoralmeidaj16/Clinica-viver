'use client';

interface Props {
  hours: string;
  minutes: string;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
}

/** A duração escolhida é convertida para minutos apenas ao agendar. */
export function variableDurationMinutes(hours: string, minutes: string): number {
  if (!/^\d+$/.test(hours) || !/^\d+$/.test(minutes)) return Number.NaN;
  const hourValue = Number(hours);
  const minuteValue = Number(minutes);
  if (!Number.isInteger(hourValue) || !Number.isInteger(minuteValue)
    || hourValue < 0 || hourValue > 4 || minuteValue < 0 || minuteValue > 59) return Number.NaN;
  return hourValue * 60 + minuteValue;
}

export function VariableDurationFields({ hours, minutes, onHoursChange, onMinutesChange }: Props) {
  return <div className="mt-3 grid grid-cols-2 gap-3">
    <label className="block text-xs font-bold text-ink">
      Horas *
      <input type="number" required min={0} max={4} step={1} inputMode="numeric"
        aria-label="Horas da sessão" value={hours} onChange={(event) => onHoursChange(event.target.value)}
        className="input mt-1.5 w-full py-3 text-xs font-bold" />
    </label>
    <label className="block text-xs font-bold text-ink">
      Minutos *
      <input type="number" required min={0} max={hours === '4' ? 0 : 59} step={1} inputMode="numeric"
        aria-label="Minutos da sessão" value={minutes} onChange={(event) => onMinutesChange(event.target.value)}
        className="input mt-1.5 w-full py-3 text-xs font-bold" />
    </label>
  </div>;
}

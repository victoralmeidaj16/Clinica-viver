import type { ManualAppointmentMode } from '@/lib/manualAppointment';

export function ManualAppointmentModeFields({ value, onChange, disabled }: {
  value: ManualAppointmentMode;
  onChange: (value: ManualAppointmentMode) => void;
  disabled: boolean;
}) {
  return <fieldset disabled={disabled}>
    <legend className="text-xs font-bold text-ink">Modalidade</legend>
    <div className="mt-1.5 grid grid-cols-2 gap-2">
      {([{ value: 'video', label: 'Online' }, { value: 'in_person', label: 'Presencial' }] as const).map((item) => (
        <button key={item.value} type="button" onClick={() => onChange(item.value)}
          className={`rounded-xl border px-2 py-3 text-[11px] font-extrabold transition ${value === item.value ? 'border-psi-vibrant bg-psi-vibrant text-white shadow-md shadow-psi-vibrant/15' : 'border-line bg-slate-50 text-muted hover:border-psi-vibrant/40 hover:text-ink'}`}>
          {item.label}
        </button>
      ))}
    </div>
  </fieldset>;
}

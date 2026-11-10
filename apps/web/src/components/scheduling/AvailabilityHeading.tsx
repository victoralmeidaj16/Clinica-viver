import { CalendarDays } from 'lucide-react';

export function AvailabilityHeading() {
  return (
    <div id="agenda-disponibilidade" className="flex items-center gap-4">
      <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-psi-soft">
        <CalendarDays className="h-6 w-6 text-psi-deep" />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-2xl font-black tracking-tight text-psi-darkest">Sua disponibilidade</h2>
        <p className="mt-0.5 max-w-xl text-[13px] leading-relaxed text-psi-deep">
          Configure seus dias e horários para que seus pacientes possam agendar os atendimentos pelo seu link.
        </p>
      </div>
    </div>
  );
}

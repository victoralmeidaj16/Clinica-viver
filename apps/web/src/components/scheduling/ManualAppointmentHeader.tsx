import { CalendarPlus, X } from 'lucide-react';

export function ManualAppointmentHeader({ onClose }: { onClose: () => void }) {
  return (
    <header className="relative shrink-0 overflow-hidden bg-psi-darkest px-5 py-4 text-white sm:px-6">
      <div className="absolute -right-10 -top-16 h-40 w-40 rounded-full border-[28px] border-psi-vibrant/15" />
      <div className="relative flex items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="rounded-2xl bg-psi-vibrant p-3 shadow-lg shadow-psi-vibrant/20"><CalendarPlus className="h-5 w-5" /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.22em] text-psi-vibrant">Agenda clínica</p>
            <h2 id="manual-appointment-title" className="mt-1 text-xl font-extrabold">Novo agendamento</h2>
            <p className="mt-1 text-xs text-psi-soft/75">Registre o horário combinado diretamente com o paciente.</p>
          </div>
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-xl p-2 text-psi-soft hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
      </div>
    </header>
  );
}

import { CalendarPlus, Loader2 } from 'lucide-react';

interface Props {
  success: boolean;
  saving: boolean;
  disabled: boolean;
  count: number;
  onClose: () => void;
}

export function ManualAppointmentActions({ success, saving, disabled, count, onClose }: Props) {
  return (
    <div className="flex shrink-0 gap-2 border-t border-line bg-white p-4 sm:px-6">
      <button type="button" onClick={onClose} className="btn-outline flex-1 justify-center py-3 text-xs">{success ? 'Concluir' : 'Cancelar'}</button>
      {!success && <button type="submit" disabled={disabled} className="btn-accent flex-1 justify-center py-3 text-xs disabled:opacity-50">
        {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : <><CalendarPlus className="h-4 w-4" /> Agendar {count} {count === 1 ? 'sessão' : 'sessões'}</>}
      </button>}
    </div>
  );
}

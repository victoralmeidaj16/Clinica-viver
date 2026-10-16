import { Send } from 'lucide-react';

export function AcoesSolicitacaoGestao({ salvando, onCancelar }: {
  salvando: boolean;
  onCancelar: () => void;
}) {
  return (
    <div className="flex items-center justify-between pt-4 border-t border-line">
      <button
        type="button"
        onClick={onCancelar}
        disabled={salvando}
        className="px-5 py-2.5 rounded-xl border border-line text-muted font-bold text-xs hover:bg-canvas hover:text-ink transition-colors"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={salvando}
        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-psi-deep text-white font-extrabold text-xs shadow-md hover:bg-psi-darkest active:scale-95 transition-all disabled:opacity-60"
      >
        <Send className="h-4 w-4" />
        <span>{salvando ? 'Enviando solicitação…' : 'Enviar Solicitação à Gestão'}</span>
      </button>
    </div>
  );
}

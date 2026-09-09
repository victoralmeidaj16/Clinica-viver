'use client';

import { CheckCircle2, Clock3, Loader2 } from 'lucide-react';

interface Props {
  totalHorarios: number;
  totalDias: number;
  motivo: string;
  executando: boolean;
  onMotivoChange: (valor: string) => void;
  onConfirmar: () => void;
  onDesmarcarTodos: () => void;
}

export function BatchBlockConfirmationBar({
  totalHorarios,
  totalDias,
  motivo,
  executando,
  onMotivoChange,
  onConfirmar,
  onDesmarcarTodos,
}: Props) {
  if (totalHorarios === 0) return null;

  return (
    <div className="rounded-2xl border-2 border-psi-vibrant bg-psi-vibrant/5 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-black text-psi-darkest">
          <CheckCircle2 className="h-4 w-4 text-psi-vibrant" />
          {totalHorarios} horário{totalHorarios > 1 ? 's' : ''} em {totalDias} dia{totalDias > 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={onDesmarcarTodos}
          className="text-[11px] font-bold text-slate-500 transition hover:text-rose-600"
        >
          Desmarcar todos
        </button>
      </div>

      <div className="mt-3 space-y-2.5">
        <input
          type="text"
          value={motivo}
          onChange={(e) => onMotivoChange(e.target.value)}
          placeholder="Motivo do bloqueio (opcional: reunião, consulta, etc.)"
          className="input py-2 text-xs"
        />
        <button
          type="button"
          disabled={executando}
          onClick={onConfirmar}
          className="btn-accent w-full py-2.5 text-xs shadow-sm"
        >
          {executando ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Bloqueando horários…
            </>
          ) : (
            <>
              <Clock3 className="h-4 w-4" />
              Bloquear {totalHorarios} horário{totalHorarios > 1 ? 's' : ''}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

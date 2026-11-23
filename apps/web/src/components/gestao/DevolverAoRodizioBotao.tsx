'use client';

import { useState } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * "Devolver ao rodízio" para um caso que aguarda decisão da gestão
 * (especificação final, 4.05 e 6.07). Quem já recusou ou não respondeu não
 * recebe o pedido de novo; sem outro compatível, o caso continua na gestão.
 */
export function DevolverAoRodizioBotao({ leadId, compacto = false, onConcluido }: {
  leadId: string;
  compacto?: boolean;
  /** Recebe o aviso a exibir, quando houver, e recarrega a fila. */
  onConcluido: (aviso?: string) => Promise<void> | void;
}) {
  const [enviando, setEnviando] = useState(false);

  const devolver = async () => {
    setEnviando(true);
    try {
      const resposta = await fetch(`/api/application/triagem/${encodeURIComponent(leadId)}/devolver-rodizio`, { method: 'POST' });
      const corpo = await resposta.json().catch(() => ({}));
      if (!corpo.success) await onConcluido(corpo.error ?? 'Não foi possível devolver ao rodízio.');
      else await onConcluido(corpo.situacao === 'sem_candidato' ? corpo.message : undefined);
    } catch {
      await onConcluido('Falha de conexão ao devolver ao rodízio.');
    } finally {
      setEnviando(false);
    }
  };

  const tamanho = compacto
    ? 'mt-1.5 rounded-lg px-2 py-1 text-[10px]'
    : 'w-full rounded-xl px-3 py-2.5 text-[11px] justify-center';

  return (
    <button
      type="button"
      disabled={enviando}
      onClick={(event) => { event.stopPropagation(); void devolver(); }}
      className={`${tamanho} flex items-center gap-1 border border-line bg-surface font-extrabold text-ink transition-colors hover:bg-slate-100 disabled:opacity-60`}
    >
      <RotateCcw className="h-3 w-3 text-psi-vibrant" />
      {enviando ? 'Devolvendo…' : 'Devolver ao rodízio'}
    </button>
  );
}

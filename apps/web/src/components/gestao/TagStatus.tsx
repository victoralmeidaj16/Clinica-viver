import type { LucideIcon } from 'lucide-react';

/**
 * Base neutra das tags e indicadores de status: fundo branco, borda cinza
 * discreta e texto escuro, a mesma do botão "Pausar". A cor, quando ajuda a
 * reconhecer o estado, fica só no ícone — a tag inteira colorida competia com
 * tudo ao redor sem dizer o que era mais importante.
 */
export const TAG_NEUTRA = 'border border-slate-200 bg-white text-slate-700';

/** Cores de ícone por estado. Neutro é o padrão; as outras só quando informam. */
export const COR_ICONE = {
  neutro: 'text-slate-400',
  positivo: 'text-emerald-600',
  atencao: 'text-amber-600',
  negativo: 'text-rose-600',
  ausente: 'text-sky-600',
  marca: 'text-psi-vibrant',
} as const;

export function TagStatus({
  icone: Icone,
  cor = 'neutro',
  title,
  className = '',
  children,
}: {
  icone?: LucideIcon;
  cor?: keyof typeof COR_ICONE;
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${TAG_NEUTRA} ${className}`}
    >
      {Icone && <Icone aria-hidden className={`h-3 w-3 shrink-0 ${COR_ICONE[cor]}`} />}
      {children}
    </span>
  );
}

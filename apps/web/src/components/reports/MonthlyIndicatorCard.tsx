import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DistributionItem } from '@/lib/monthlyIndicators';

export function MonthlyIndicatorCard({
  number,
  title,
  value,
  detail,
  icon: Icon,
  children,
  wide = false,
  unavailable = false,
  info,
}: {
  number: number;
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  children?: ReactNode;
  wide?: boolean;
  unavailable?: boolean;
  info?: string;
}) {
  return (
    <article className={`rounded-3xl border p-5 shadow-card ${wide ? 'md:col-span-2' : ''} ${unavailable ? 'border-dashed border-amber-200 bg-amber-50/50' : 'border-line bg-surface'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">{number}. {title}</span>
          {info && (
            <span
              tabIndex={0}
              role="img"
              aria-label={`Informação sobre ${title}: ${info}`}
              title={info}
              className="shrink-0 cursor-help text-xs leading-none text-muted/70 outline-none transition-colors hover:text-psi-vibrant focus:text-psi-vibrant"
            >
              ⓘ
            </span>
          )}
        </div>
        <Icon className={`h-4 w-4 shrink-0 ${unavailable ? 'text-amber-600' : 'text-psi-vibrant'}`} />
      </div>
      <h2 className={`mt-3 text-xl font-black ${unavailable ? 'text-amber-900' : 'text-ink'}`}>{value}</h2>
      <p className="mt-1 text-[11px] font-medium text-muted">{detail}</p>
      {children}
    </article>
  );
}

export function DistributionBars({ items }: { items: DistributionItem[] }) {
  const visible = items.filter((item) => item.quantidade > 0);
  if (visible.length === 0) return <p className="mt-4 text-xs font-semibold text-muted">Sem dados na competência.</p>;
  return (
    <div className="mt-4 space-y-2">
      {visible.map((item, index) => (
        <div key={item.label}>
          <div className="mb-1 flex justify-between gap-3 text-[10px] font-bold text-muted">
            <span className="truncate">{item.label}</span>
            <span>{item.quantidade} · {item.percentual}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-psi-soft">
            <div
              className={index % 2 === 0 ? 'h-full rounded-full bg-psi-deep' : 'h-full rounded-full bg-psi-vibrant'}
              style={{ width: `${item.percentual}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

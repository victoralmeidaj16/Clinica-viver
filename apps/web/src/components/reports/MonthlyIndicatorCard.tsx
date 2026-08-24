'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, Info } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { DistributionItem } from '@/lib/monthlyIndicators';

function InfoTooltip({ info, title }: { info: string; title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onFocus={() => setIsOpen(true)}
        aria-label={`Informação sobre ${title}`}
        className="shrink-0 cursor-pointer p-0.5 text-slate-400 hover:text-psi-vibrant focus:text-psi-vibrant outline-none transition-colors"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {isOpen && (
        <div
          role="tooltip"
          className="absolute left-0 top-full mt-2 z-30 w-64 p-3.5 bg-slate-900 text-white text-xs rounded-2xl shadow-xl border border-slate-700/60 leading-relaxed animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="font-bold text-[11px] text-purple-300 mb-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
            <span>Sobre este indicador</span>
          </div>
          {info}
        </div>
      )}
    </div>
  );
}

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
    <article
      className={`rounded-3xl border p-5 shadow-card ${wide ? 'md:col-span-2' : ''} ${
        unavailable ? 'border-dashed border-amber-200 bg-amber-50/50' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
            {number}. {title}
          </span>
          {info && <InfoTooltip info={info} title={title} />}
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
            <span>
              {item.quantidade} · {item.percentual}%
            </span>
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

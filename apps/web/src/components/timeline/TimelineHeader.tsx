import { BookOpenCheck, Fingerprint, Layers3 } from 'lucide-react';
import type { ClinicalTimelineEntry } from '@thats-life/core';

interface TimelineHeaderProps {
  patientName: string;
  entries: readonly ClinicalTimelineEntry[];
}

export default function TimelineHeader({
  patientName,
  entries,
}: TimelineHeaderProps) {
  const sources = new Set(
    entries.map((entry) => `${entry.evidence.sourceType}:${entry.evidence.sourceId}`)
  ).size;
  const firstEntry = entries.at(-1);

  return (
    <header className="relative overflow-hidden rounded-[28px] bg-ink px-6 py-7 text-white shadow-xl sm:px-8">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.08]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />
      <div className="relative grid gap-7 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <div className="mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-capri">
            <BookOpenCheck className="h-4 w-4" />
            Dossiê longitudinal verificável
          </div>
          <h1 className="max-w-3xl font-serif text-3xl font-semibold leading-tight sm:text-4xl">
            A história clínica, com origem em cada detalhe.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
            Linha do tempo de {patientName}. Cada marco aponta para o registro,
            campo e versão que sustentam a informação.
          </p>
        </div>

        <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur">
          <Metric icon={<Layers3 className="h-4 w-4" />} value={entries.length} label="marcos" />
          <Metric icon={<Fingerprint className="h-4 w-4" />} value={sources} label="fontes" />
          <Metric
            icon={<BookOpenCheck className="h-4 w-4" />}
            value={firstEntry ? new Date(firstEntry.occurredAt).getFullYear() : '—'}
            label="desde"
          />
        </div>
      </div>
    </header>
  );
}

function Metric({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
}) {
  return (
    <div className="min-w-20 border-r border-white/10 px-4 py-3 last:border-r-0">
      <div className="mb-2 text-capri">{icon}</div>
      <p className="font-serif text-2xl leading-none">{value}</p>
      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-white/45">{label}</p>
    </div>
  );
}

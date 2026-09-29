import type {
  ClinicalTimelineCategory,
  ClinicalTimelineEntry,
} from '@thats-life/core';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckSquare2,
  ClipboardCheck,
  FileCheck2,
  Flag,
  HeartPulse,
  Leaf,
  Stethoscope,
} from 'lucide-react';

const CATEGORY_META: Readonly<
  Record<ClinicalTimelineCategory, { label: string; icon: typeof Activity; color: string }>
> = {
  clinical_record: { label: 'Prontuário', icon: FileCheck2, color: 'bg-primary text-white' },
  session: { label: 'Sessão', icon: Stethoscope, color: 'bg-slate-700 text-white' },
  assessment: { label: 'Escala', icon: ClipboardCheck, color: 'bg-cyan-600 text-white' },
  mood: { label: 'Humor', icon: HeartPulse, color: 'bg-rose-500 text-white' },
  habit: { label: 'Hábito', icon: Leaf, color: 'bg-emerald-600 text-white' },
  task: { label: 'Tarefa', icon: CheckSquare2, color: 'bg-amber-500 text-white' },
  goal: { label: 'Meta', icon: Flag, color: 'bg-violet-600 text-white' },
  pre_session: { label: 'Pré-sessão', icon: Activity, color: 'bg-blue-600 text-white' },
  appointment: { label: 'Agenda', icon: CalendarClock, color: 'bg-slate-500 text-white' },
  alert: { label: 'Alerta', icon: AlertTriangle, color: 'bg-coral text-white' },
};


interface TimelineFeedProps {
  entries: readonly ClinicalTimelineEntry[];
}

export default function TimelineFeed({ entries }: TimelineFeedProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line bg-white p-10 text-center">
        <p className="font-serif text-xl text-ink">Nenhum marco neste recorte.</p>
        <p className="mt-1 text-xs text-muted">Altere o filtro para ampliar a linha do tempo.</p>
      </div>
    );
  }

  return (
    <ol className="relative space-y-5 before:absolute before:bottom-6 before:left-[27px] before:top-6 before:w-px before:bg-line">
      {entries.map((entry) => (
        <TimelineEventCard key={entry.id} entry={entry} />
      ))}
    </ol>
  );
}

function TimelineEventCard({ entry }: { entry: ClinicalTimelineEntry }) {
  const meta = CATEGORY_META[entry.category];
  const Icon = meta.icon;
  const date = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(entry.occurredAt));

  return (
    <li className="relative grid grid-cols-[56px_1fr] gap-4">
      <div className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl shadow-sm ${meta.color}`}>
        <Icon className="h-5 w-5" />
      </div>

      <article className="group rounded-2xl border border-line bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-primary">
                {meta.label}
              </span>
              {entry.importance === 'attention' ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold text-rose-700">
                  Revisão humana
                </span>
              ) : null}
              {entry.importance === 'milestone' ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                  Marco
                </span>
              ) : null}
            </div>
            <h3 className="text-sm font-extrabold text-ink">{entry.title}</h3>
          </div>
          <time className="shrink-0 font-serif text-sm font-semibold text-muted">
            {date}
          </time>
        </div>

        <p className="mt-2 text-xs leading-relaxed text-muted">{entry.summary}</p>
        {entry.evidenceExcerpt ? (
          <blockquote className="mt-3 whitespace-pre-line border-l-2 border-capri bg-canvas/60 px-3 py-2 font-serif text-[13px] italic leading-relaxed text-ink">
            “{entry.evidenceExcerpt}”
          </blockquote>
        ) : null}

      </article>
    </li>
  );
}

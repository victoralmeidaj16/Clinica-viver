import type { ClinicalTimelineCategory } from '@thats-life/core';

export interface TimelineFilterOption {
  id: string;
  label: string;
  categories?: readonly ClinicalTimelineCategory[];
}

export const TIMELINE_FILTERS: readonly TimelineFilterOption[] = [
  { id: 'all', label: 'Todos' },
  { id: 'clinical', label: 'Clínico', categories: ['clinical_record', 'session'] },
  { id: 'measures', label: 'Escalas', categories: ['assessment'] },
  { id: 'journey', label: 'Jornada', categories: ['mood', 'habit', 'task', 'goal', 'pre_session'] },
  { id: 'operations', label: 'Agenda', categories: ['appointment'] },
  { id: 'attention', label: 'Alertas', categories: ['alert'] },
];

interface TimelineFiltersProps {
  activeId: string;
  onChange: (id: string) => void;
}

export default function TimelineFilters({
  activeId,
  onChange,
}: TimelineFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Filtrar linha do tempo">
      {TIMELINE_FILTERS.map((filter) => {
        const active = filter.id === activeId;
        return (
          <button
            key={filter.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(filter.id)}
            className={`rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
              active
                ? 'border-ink bg-ink text-white'
                : 'border-line bg-white text-muted hover:border-primary/30 hover:text-ink'
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
}

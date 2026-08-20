import { Activity, FileText } from 'lucide-react';

export type TimelineSection = 'prontuarios' | 'sessoes';

interface TimelineSectionTabsProps {
  active: TimelineSection;
  recordsCount: number;
  sessionsCount: number;
  onChange: (section: TimelineSection) => void;
}

export default function TimelineSectionTabs({ active, recordsCount, sessionsCount, onChange }: TimelineSectionTabsProps) {
  const tabs = [
    { id: 'prontuarios' as const, label: 'Prontuários', compact: 'Prontuários', count: recordsCount, icon: FileText },
    { id: 'sessoes' as const, label: 'Histórico de Sessões', compact: 'Sessões', count: sessionsCount, icon: Activity },
  ];

  return (
    <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-white p-1.5 shadow-sm" role="tablist" aria-label="Seções do prontuário">
      {tabs.map(({ id, label, compact, count, icon: Icon }) => {
        const selected = active === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(id)}
            className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-xs font-extrabold transition sm:px-4 ${selected ? 'bg-psi-darkest text-white shadow-sm' : 'text-muted hover:bg-canvas hover:text-ink'}`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${selected ? 'text-psi-vibrant' : ''}`} />
            <span className="truncate"><span className="sm:hidden">{compact}</span><span className="hidden sm:inline">{label}</span></span>
            <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] ${selected ? 'bg-white/10 text-white' : 'bg-canvas text-muted'}`}>{count}</span>
          </button>
        );
      })}
    </div>
  );
}

'use client';

import { useMemo, useState } from 'react';
import { searchClinicalTimeline } from '@thats-life/core';
import { DEMO_CLINICAL_TIMELINE } from '@/lib/demoClinicalTimeline';
import ClinicalMemorySearch from './ClinicalMemorySearch';
import TimelineFeed from './TimelineFeed';
import TimelineFilters, { TIMELINE_FILTERS } from './TimelineFilters';
import TimelineHeader from './TimelineHeader';

const DEFAULT_QUERY = 'Quando começou a relatar dificuldades no trabalho?';

export default function ClinicalTimelineWorkspace() {
  const [activeFilterId, setActiveFilterId] = useState('all');
  const [draftQuery, setDraftQuery] = useState(DEFAULT_QUERY);
  const [activeQuery, setActiveQuery] = useState(DEFAULT_QUERY);
  const activeFilter = TIMELINE_FILTERS.find(
    (filter) => filter.id === activeFilterId
  );
  const filteredEntries = useMemo(
    () =>
      activeFilter?.categories
        ? DEMO_CLINICAL_TIMELINE.filter((entry) =>
            activeFilter.categories?.includes(entry.category)
          )
        : DEMO_CLINICAL_TIMELINE,
    [activeFilter]
  );
  const searchResult = useMemo(
    () => searchClinicalTimeline(DEMO_CLINICAL_TIMELINE, activeQuery),
    [activeQuery]
  );

  const runSuggestion = (value: string) => {
    setDraftQuery(value);
    setActiveQuery(value);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <TimelineHeader
        patientName="Mariana Silva de Oliveira"
        entries={DEMO_CLINICAL_TIMELINE}
      />

      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Recorte da jornada
          </p>
          <p className="text-xs text-ink">
            {filteredEntries.length} marcos exibidos em ordem cronológica reversa
          </p>
        </div>
        <TimelineFilters activeId={activeFilterId} onChange={setActiveFilterId} />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TimelineFeed entries={filteredEntries} />
        <ClinicalMemorySearch
          draftQuery={draftQuery}
          result={searchResult}
          onDraftChange={setDraftQuery}
          onSearch={() => setActiveQuery(draftQuery)}
          onSuggestion={runSuggestion}
        />
      </div>
    </div>
  );
}

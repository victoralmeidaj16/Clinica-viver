'use client';

import { useEffect, useMemo, useState } from 'react';
import { searchClinicalTimeline, type ClinicalTimelineEntry } from '@thats-life/core';
import { applicationRequest } from '@/lib/applicationApi';
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
  const [apiEntries, setApiEntries] = useState<ClinicalTimelineEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    applicationRequest<{ entries: ClinicalTimelineEntry[] }>('/timeline?patientId=patient-1')
      .then((data) => {
        if (!cancelled && data?.entries?.length) {
          setApiEntries(data.entries);
        }
      })
      .catch(() => {
        // Fallback para dados locais em caso de falha de conexão
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const allEntries = apiEntries ?? DEMO_CLINICAL_TIMELINE;

  const activeFilter = TIMELINE_FILTERS.find(
    (filter) => filter.id === activeFilterId
  );
  const filteredEntries = useMemo(
    () =>
      activeFilter?.categories
        ? allEntries.filter((entry) =>
            activeFilter.categories?.includes(entry.category)
          )
        : allEntries,
    [activeFilter, allEntries]
  );
  const searchResult = useMemo(
    () => searchClinicalTimeline(allEntries, activeQuery),
    [activeQuery, allEntries]
  );

  const runSuggestion = (value: string) => {
    setDraftQuery(value);
    setActiveQuery(value);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <TimelineHeader
        patientName="Mariana Silva de Oliveira"
        entries={allEntries}
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

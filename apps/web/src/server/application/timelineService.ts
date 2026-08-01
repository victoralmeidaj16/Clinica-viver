import {
  listClinicalTimelineForStaff,
  searchClinicalTimelineForStaff,
  type ClinicalTimelineCategory,
} from '@thats-life/core';
import type { RequestContext } from './context';
import { getApplicationStore } from './store';

export interface TimelineQueryInput {
  patientId: string;
  query?: string;
  categories?: readonly ClinicalTimelineCategory[];
  occurredFrom?: string;
  occurredUntil?: string;
}

export async function getClinicalTimeline(
  context: RequestContext,
  input: TimelineQueryInput
) {
  const store = getApplicationStore();
  const metadata = {
    occurredAt: new Date().toISOString(),
    correlationId: context.correlationId,
  };

  const dependencies = {
    timelines: store.timeline,
    identities: store.identities,
    audit: store.timelineAudit,
  };

  if (input.query && input.query.trim().length > 0) {
    const searchResult = await searchClinicalTimelineForStaff(
      dependencies,
      context.actor,
      {
        patientId: input.patientId,
        query: input.query,
        categories: input.categories,
      },
      metadata
    );

    return {
      mode: searchResult.mode,
      query: searchResult.query,
      normalizedTerms: searchResult.normalizedTerms,
      firstEvidenceAt: searchResult.firstEvidenceAt,
      entries: searchResult.matches.map((m) => ({
        ...m.entry,
        score: m.score,
        matchedTerms: m.matchedTerms,
      })),
    };
  }

  const entries = await listClinicalTimelineForStaff(
    dependencies,
    context.actor,
    {
      patientId: input.patientId,
      categories: input.categories,
      occurredFrom: input.occurredFrom,
      occurredUntil: input.occurredUntil,
    },
    metadata
  );

  return {
    mode: 'chronological',
    query: undefined,
    normalizedTerms: [],
    entries: entries.map((e) => ({ ...e, score: undefined, matchedTerms: [] })),
  };
}

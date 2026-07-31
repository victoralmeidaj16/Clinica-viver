import type {
  ClinicalTimelineEntry,
  ClinicalTimelineSearchMatch,
  ClinicalTimelineSearchResult,
} from './types';

const STOP_WORDS = new Set([
  'a', 'ao', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em',
  'foi', 'no', 'nos', 'o', 'os', 'para', 'paciente', 'por', 'quando', 'que',
  'relata', 'relatar', 'sobre', 'um', 'uma',
]);

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function queryTerms(query: string): readonly string[] {
  const all = normalize(query).split(/\s+/).filter((term) => term.length > 1);
  const meaningful = all.filter((term) => !STOP_WORDS.has(term));
  return Array.from(new Set(meaningful.length > 0 ? meaningful : all));
}

function searchableText(entry: ClinicalTimelineEntry): string {
  return normalize([
    entry.title,
    entry.summary,
    entry.evidenceExcerpt,
    ...entry.tags,
  ].filter(Boolean).join(' '));
}

export function searchClinicalTimeline(
  entries: readonly ClinicalTimelineEntry[],
  query: string
): ClinicalTimelineSearchResult {
  const terms = queryTerms(query);
  if (terms.length === 0) {
    return {
      mode: 'evidence_only',
      query,
      normalizedTerms: [],
      matches: [],
    };
  }

  const matches: ClinicalTimelineSearchMatch[] = entries.flatMap((entry) => {
    const haystack = searchableText(entry);
    const matchedTerms = terms.filter((term) => haystack.includes(term));
    if (matchedTerms.length === 0) return [];
    const exactPhraseBonus = haystack.includes(normalize(query)) ? 5 : 0;
    return [{
      entry,
      matchedTerms,
      score: matchedTerms.length * 10 + exactPhraseBonus,
    }];
  }).sort(
    (first, second) =>
      second.score - first.score ||
      first.entry.occurredAt.localeCompare(second.entry.occurredAt)
  );

  const firstEvidenceAt = matches
    .map((match) => match.entry.occurredAt)
    .sort()[0];

  return {
    mode: 'evidence_only',
    query,
    normalizedTerms: terms,
    matches,
    firstEvidenceAt,
  };
}

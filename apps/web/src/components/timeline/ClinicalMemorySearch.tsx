import type { ClinicalTimelineSearchResult } from '@thats-life/core';
import { CheckCircle2, Fingerprint, Search, Sparkles } from 'lucide-react';

const SUGGESTIONS = [
  'dificuldades no trabalho',
  'ansiedade',
  'liderança',
] as const;

interface ClinicalMemorySearchProps {
  draftQuery: string;
  result: ClinicalTimelineSearchResult;
  onDraftChange: (value: string) => void;
  onSearch: () => void;
  onSuggestion: (value: string) => void;
}

export default function ClinicalMemorySearch({
  draftQuery,
  result,
  onDraftChange,
  onSearch,
  onSuggestion,
}: ClinicalMemorySearchProps) {
  const firstDate = result.firstEvidenceAt
    ? new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      }).format(new Date(result.firstEvidenceAt))
    : null;

  return (
    <aside className="space-y-4 lg:sticky lg:top-28">
      <div className="overflow-hidden rounded-[24px] border border-ink bg-ink text-white shadow-xl">
        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-capri">
            <Fingerprint className="h-4 w-4" />
            Memória verificável
          </div>
          <h2 className="mt-2 font-serif text-xl">Pergunte ao histórico</h2>
          <p className="mt-1 text-[11px] leading-relaxed text-white/55">
            Busca literal em fontes autorizadas. Nenhuma resposta é inventada.
          </p>
        </div>

        <div className="p-5">
          <label htmlFor="timeline-memory-query" className="sr-only">
            Consultar memória clínica
          </label>
          <textarea
            id="timeline-memory-query"
            value={draftQuery}
            onChange={(event) => onDraftChange(event.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/15 bg-white/[0.07] px-3 py-2.5 text-xs leading-relaxed text-white outline-none placeholder:text-white/35 focus:border-capri"
            placeholder="Ex.: Quando começaram as dificuldades no trabalho?"
          />
          <button
            type="button"
            onClick={onSearch}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-capri px-4 py-2.5 text-xs font-extrabold text-ink transition hover:bg-cyan-300"
          >
            <Search className="h-4 w-4" />
            Buscar evidências
          </button>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestion(suggestion)}
                className="rounded-full border border-white/10 px-2 py-1 text-[9px] text-white/55 transition hover:border-white/30 hover:text-white"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-psi-soft bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Evidências encontradas
          </p>
          <span className="rounded-full bg-psi-darkest px-2.5 py-0.5 text-[9px] font-bold text-white">
            {result.matches.length}
          </span>
        </div>

        {firstDate ? (
          <div className="mt-4 rounded-xl border border-psi-soft bg-psi-light p-3">
            <div className="flex gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-psi-deep" />
              <div>
                <p className="text-[10px] font-bold uppercase text-psi-darkest">
                  Primeira evidência localizada
                </p>
                <p className="mt-1 font-bold text-lg text-ink">{firstDate}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-dashed border-line p-4 text-center">
            <Sparkles className="mx-auto h-5 w-5 text-muted" />
            <p className="mt-2 text-[11px] text-muted">Nenhuma evidência literal localizada.</p>
          </div>
        )}

        <div className="mt-3 space-y-2">
          {result.matches.slice(0, 3).map((match) => (
            <div key={match.entry.id} className="rounded-xl border border-line bg-white p-3">
              <p className="text-[10px] font-bold text-primary">
                {new Intl.DateTimeFormat('pt-BR').format(new Date(match.entry.occurredAt))}
                {' • '}
                {match.entry.title}
              </p>
              <p className="mt-1 line-clamp-3 font-serif text-xs italic leading-relaxed text-ink">
                “{match.entry.evidenceExcerpt ?? match.entry.summary}”
              </p>
              <p className="mt-2 font-mono text-[8px] text-muted">
                {match.entry.evidence.sourceType} / {match.entry.evidence.sourceId}
              </p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

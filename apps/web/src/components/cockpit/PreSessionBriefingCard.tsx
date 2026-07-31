import type { PreSessionBriefing } from '@thats-life/core';
import {
  Activity,
  ClipboardCheck,
  MessageCircle,
  ShieldAlert,
} from 'lucide-react';

interface PreSessionBriefingCardProps {
  briefing: PreSessionBriefing | null;
}

const MOOD_LABELS: Readonly<Record<number, string>> = {
  1: 'Muito baixo',
  2: 'Baixo',
  3: 'Regular',
  4: 'Bom',
  5: 'Muito bom',
};

export default function PreSessionBriefingCard({
  briefing,
}: PreSessionBriefingCardProps) {
  if (!briefing) {
    return (
      <section className="card border-dashed bg-canvas/50 py-4">
        <div className="flex items-center gap-3 text-muted">
          <ClipboardCheck className="h-5 w-5" />
          <div>
            <p className="text-xs font-bold text-ink">Briefing pré-sessão</p>
            <p className="text-[11px]">
              Este paciente não enviou um check-in para a próxima sessão.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`card space-y-4 ${
        briefing.reviewRequired
          ? 'border-rose-200 bg-rose-50/60'
          : 'border-capri/30 bg-capri-soft/30'
      }`}
    >
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-primary shadow-sm">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-extrabold text-ink">Briefing pré-sessão</h2>
              <span className="chip-capri text-[10px]">Enviado pelo paciente</span>
            </div>
            <p className="text-[11px] text-muted">
              Material de preparação — não faz parte do prontuário SOAP.
            </p>
          </div>
        </div>

        {briefing.reviewRequired ? (
          <span className="chip border-rose-200 bg-rose-100 text-rose-800">
            <ShieldAlert className="h-3.5 w-3.5" />
            Revisão humana necessária
          </span>
        ) : null}
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-line bg-white p-3">
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase text-muted">
            <Activity className="h-3.5 w-3.5 text-primary" />
            Indicadores
          </div>
          <p className="text-xs font-bold text-ink">
            Humor: {briefing.moodLevel ? MOOD_LABELS[briefing.moodLevel] : 'Não informado'}
          </p>
          {briefing.assessment ? (
            <p className="mt-1 text-[11px] text-muted">
              {briefing.assessment.instrumentCode}: {briefing.assessment.totalScore} pontos
              {' • '}
              {briefing.assessment.severityLabel}
            </p>
          ) : null}
        </div>

        {briefing.topicsToDiscuss ? (
          <div className="rounded-xl border border-line bg-white p-3">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase text-muted">
              <MessageCircle className="h-3.5 w-3.5 text-capri" />
              Assuntos informados — opcional
            </div>
            <p className="text-xs leading-relaxed text-ink">
              “{briefing.topicsToDiscuss}”
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-line bg-white/60 p-3">
            <p className="text-[11px] text-muted">
              O paciente preferiu não adicionar assuntos para esta sessão.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

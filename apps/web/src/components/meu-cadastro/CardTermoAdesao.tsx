'use client';

import React from 'react';
import { CheckCircle2, Download, ExternalLink, ShieldCheck } from 'lucide-react';

interface CardTermoAdesaoProps {
  cadastroId: string;
  possuiComprovante: boolean;
  versaoTermos?: string;
  aceitoEm?: string;
  onAbrirTermo: () => void;
}

function formatarAceite(iso?: string): string | undefined {
  if (!iso) return undefined;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return undefined;
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(data);
}

/** Exibe o Termo de Adesão aceito e libera o download do PDF pelo próprio psicólogo. */
export function CardTermoAdesao({
  cadastroId,
  possuiComprovante,
  versaoTermos,
  aceitoEm,
  onAbrirTermo,
}: CardTermoAdesaoProps) {
  const dataFormatada = formatarAceite(aceitoEm);
  const urlDownload = `/api/application/credenciamento-psicologo/${encodeURIComponent(cadastroId)}/comprovante-termo`;

  return (
    <section className="bg-surface rounded-3xl border border-line shadow-card p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-psi-vibrant" />
          <h2 className="font-black text-ink">Termo de Adesão e Condições de Uso</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {possuiComprovante && (
            <a
              href={urlDownload}
              className="inline-flex items-center gap-1.5 rounded-xl border border-psi-soft bg-psi-soft/40 px-3 py-1.5 text-xs font-extrabold text-psi-deep hover:bg-psi-soft transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar comprovante (PDF)</span>
            </a>
          )}
          <button
            type="button"
            onClick={onAbrirTermo}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-psi-deep hover:text-psi-darkest underline"
          >
            <span>Consultar termo completo</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="bg-psi-soft/40 border border-psi-soft p-4 rounded-2xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-extrabold text-psi-darkest">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Adesão em Conformidade Ética e Contratual</span>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Consulte as condições operacionais, financeiras, éticas e de proteção de dados aceitas no seu credenciamento.
          {(versaoTermos || dataFormatada) && (
            <span className="block mt-1 font-semibold text-ink/80">
              {versaoTermos ? `Versão ${versaoTermos}` : 'Termo aceito'}
              {dataFormatada ? ` · Aceite registrado em ${dataFormatada}` : ''}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}

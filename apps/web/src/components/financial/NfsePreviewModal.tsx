'use client';

import { AlertTriangle, FileText, Loader2, ShieldCheck, X } from 'lucide-react';
import { NfseCancellationPanel } from './NfseCancellationPanel';
import type { MotivoCancelamentoNfse } from '@thats-life/core';
import { NfsePreviewDetails } from './NfsePreviewDetails';
import { NfseStatusPanel } from './NfseStatusPanel';
import type { NfseEmissao, NfsePreview } from './nfseTypes';

export type { NfseEmissao, NfsePreview } from './nfseTypes';

interface NfsePreviewModalProps {
  previa: NfsePreview | null;
  emissao: NfseEmissao | null;
  carregando: boolean;
  erro: string;
  sucesso: string;
  emitindo: boolean;
  cancelando: boolean;
  salvandoCpf: boolean;
  onConfirmar: () => void;
  onCancelar: (motivo: string, codigoMotivo: MotivoCancelamentoNfse) => void;
  onSalvarCpf: (cpf: string) => void;
  onFechar: () => void;
  urlXml: (tipo: 'nfse' | 'dps') => string;
}

export function NfsePreviewModal({
  previa, emissao, carregando, erro, sucesso, emitindo, cancelando,
  salvandoCpf, onConfirmar, onCancelar, onSalvarCpf, onFechar, urlXml,
}: NfsePreviewModalProps) {
  const possuiPendencias = (previa?.camposPendentes.length ?? 0) > 0;
  const jaEmitida = emissao?.status === 'issued' || emissao?.status === 'cancelled';
  const podeEmitir = Boolean(previa && !possuiPendencias && previa.integracaoConfigurada) && !jaEmitida;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-labelledby="titulo-nfse" className="my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="chip-accent text-[10px]">Emissão manual · Administração</p>
            <h2 id="titulo-nfse" className="mt-1 flex items-center gap-2 text-lg font-black text-ink">
              <FileText className="h-5 w-5 text-psi-vibrant" /> Conferir NFS-e
            </h2>
          </div>
          <button type="button" onClick={onFechar} className="rounded-xl p-2 text-muted transition-colors hover:bg-slate-100 hover:text-ink" aria-label="Fechar conferência da NFS-e">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 sm:px-6">
          {carregando && (
            <p className="flex items-center gap-2 py-8 text-center text-xs font-semibold text-muted">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados fiscais…
            </p>
          )}
          {!carregando && erro && (
            <div className="flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {erro}
            </div>
          )}
          {!carregando && sucesso && (
            <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0" /> {sucesso}
            </div>
          )}
          {!carregando && emissao && <NfseStatusPanel emissao={emissao} urlXml={urlXml} />}
          {!carregando && previa && (
            <NfsePreviewDetails previa={previa} jaEmitida={jaEmitida} salvandoCpf={salvandoCpf} onSalvarCpf={onSalvarCpf} />
          )}
          {!carregando && emissao?.podeCancelar && (
            <NfseCancellationPanel cancelando={cancelando} onCancelar={onCancelar} />
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-line bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted hover:bg-slate-100 hover:text-ink">Fechar</button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!podeEmitir || emitindo}
            title={podeEmitir ? 'Gerar NFS-e' : jaEmitida ? 'Esta cobrança já tem NFS-e' : 'A emissão ainda não está configurada'}
            className="rounded-xl bg-psi-vibrant px-4 py-2.5 text-xs font-extrabold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {emissao?.status === 'issued' ? 'NFS-e emitida'
              : emissao?.status === 'cancelled' ? 'NFS-e cancelada'
                : emitindo ? 'Emitindo…' : 'Confirmar e gerar NFS-e'}
          </button>
        </footer>
      </section>
    </div>
  );
}

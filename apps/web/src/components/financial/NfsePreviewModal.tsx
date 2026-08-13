'use client';

import { AlertTriangle, FileText, Loader2, ShieldCheck, X } from 'lucide-react';

export interface NfsePreview {
  chargeId: string;
  paciente: { nome: string; cpf?: string; email?: string };
  competencia: string;
  valorCents: number;
  servico: {
    codigoTributacaoNacional: string;
    codigoNbs: string;
    descricaoPadrao: string;
    municipioPrestacao: string;
    ufPrestacao: string;
    inscricaoMunicipal: string;
  };
  camposPendentes: readonly string[];
  integracaoConfigurada: boolean;
  ambiente: 'producao_restrita' | 'producao';
  certificado?: {
    configurado: boolean;
    apto: boolean;
    validoAte?: string;
    diasParaVencer?: number;
    impedimentos: readonly string[];
    alertas: readonly string[];
  };
}

const dinheiro = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

const dataBr = (valor: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(`${valor}T12:00:00`)
  );

export function NfsePreviewModal({
  previa,
  carregando,
  erro,
  sucesso,
  emitindo,
  onConfirmar,
  onFechar,
}: {
  previa: NfsePreview | null;
  carregando: boolean;
  erro: string;
  sucesso: string;
  emitindo: boolean;
  onConfirmar: () => void;
  onFechar: () => void;
}) {
  const possuiPendencias = (previa?.camposPendentes.length ?? 0) > 0;
  const podeEmitir = Boolean(previa && !possuiPendencias && previa.integracaoConfigurada);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-nfse"
        className="my-auto w-full max-w-xl overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="chip-accent text-[10px]">Emissão manual · Administração</p>
            <h2 id="titulo-nfse" className="mt-1 flex items-center gap-2 text-lg font-black text-ink">
              <FileText className="h-5 w-5 text-psi-vibrant" />
              Conferir NFS-e
            </h2>
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="rounded-xl p-2 text-muted transition-colors hover:bg-slate-100 hover:text-ink"
            aria-label="Fechar conferência da NFS-e"
          >
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
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {erro}
            </div>
          )}

          {!carregando && sucesso && (
            <div className="flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              {sucesso}
            </div>
          )}

          {!carregando && previa && (
            <>
              {possuiPendencias && (
                <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    Antes de emitir, complete: <strong>{previa.camposPendentes.join(', ')}.</strong>
                  </span>
                </div>
              )}

              <dl className="grid gap-x-5 gap-y-4 rounded-2xl border border-line bg-slate-50/70 p-4 text-xs sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Tomador</dt>
                  <dd className="mt-1 font-extrabold text-ink">{previa.paciente.nome}</dd>
                  <dd className="text-muted">CPF: {previa.paciente.cpf ?? 'Não informado'}</dd>
                  {previa.paciente.email && <dd className="text-muted">{previa.paciente.email}</dd>}
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Competência</dt>
                  <dd className="mt-1 font-bold text-ink">{dataBr(previa.competencia)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-muted">Valor do pagamento</dt>
                  <dd className="mt-1 text-base font-black text-emerald-700">{dinheiro(previa.valorCents)}</dd>
                </div>
              </dl>

              {previa.ambiente === 'producao_restrita' && (
                <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-900">
                  Ambiente restrito: esta confirmação é usada para homologação, não para emissão em produção.
                </p>
              )}

              <section className="rounded-2xl border border-line p-4 text-xs">
                <p className="font-extrabold text-ink">Serviço fiscal</p>
                <p className="mt-1 font-semibold text-ink">Psicologia</p>
                <p className="mt-1 text-muted">{previa.servico.descricaoPadrao}</p>
                <div className="mt-3 grid gap-2 text-[11px] sm:grid-cols-2">
                  <p><span className="font-bold text-muted">Tributação Nacional:</span> {previa.servico.codigoTributacaoNacional}</p>
                  <p><span className="font-bold text-muted">NBS:</span> {previa.servico.codigoNbs}</p>
                  <p><span className="font-bold text-muted">Prestação:</span> {previa.servico.municipioPrestacao}/{previa.servico.ufPrestacao}</p>
                  <p><span className="font-bold text-muted">Inscrição municipal:</span> {previa.servico.inscricaoMunicipal}</p>
                </div>
              </section>

              {/* O motivo exato de a emissão estar bloqueada, e não um aviso
                  genérico: "certificado vencido" e "certificado de outro CNPJ"
                  se resolvem de maneiras muito diferentes. */}
              {!previa.integracaoConfigurada && (
                <div className="flex gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-900">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <div className="space-y-1">
                    <p className="font-bold">A conferência está pronta, mas a emissão segue bloqueada.</p>
                    {(previa.certificado?.impedimentos.length ?? 0) > 0 ? (
                      <ul className="list-disc space-y-0.5 pl-4">
                        {previa.certificado?.impedimentos.map((motivo) => (
                          <li key={motivo}>{motivo}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>Configure e homologue o certificado digital da clínica na NFS-e Nacional.</p>
                    )}
                  </div>
                </div>
              )}

              {previa.integracaoConfigurada && (previa.certificado?.alertas.length ?? 0) > 0 && (
                <div className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                  <ShieldCheck className="h-4 w-4 shrink-0" />
                  <div className="space-y-0.5">
                    {previa.certificado?.alertas.map((alerta) => (
                      <p key={alerta}>{alerta}</p>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-line bg-slate-50/60 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onFechar} className="rounded-xl px-4 py-2.5 text-xs font-bold text-muted hover:bg-slate-100 hover:text-ink">
            Fechar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={!podeEmitir || emitindo || Boolean(sucesso)}
            title={podeEmitir ? 'Gerar NFS-e' : 'A emissão real ainda não está configurada'}
            className="rounded-xl bg-psi-vibrant px-4 py-2.5 text-xs font-extrabold text-white shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sucesso ? 'NFS-e emitida' : emitindo ? 'Emitindo…' : 'Confirmar e gerar NFS-e'}
          </button>
        </footer>
      </section>
    </div>
  );
}

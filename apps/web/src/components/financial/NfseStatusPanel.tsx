import { Download, Eye } from 'lucide-react';
import type { NfseEmissao } from './nfseTypes';

const dataHoraBr = (valor: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
  }).format(new Date(valor));

const rotuloStatus: Record<Exclude<NfseEmissao['status'], 'none'>, string> = {
  reserved: 'Numeração reservada, sem envio',
  processing: 'Envio em andamento',
  issued: 'Emitida',
  failed: 'Falhou',
  cancelled: 'Cancelada',
};

export function NfseStatusPanel({
  emissao,
  urlXml,
  urlPdf,
}: {
  emissao: NfseEmissao;
  urlXml: (tipo: 'nfse' | 'dps') => string;
  urlPdf: (download?: boolean) => string;
}) {
  if (emissao.status === 'none') return null;

  return (
    <section className="rounded-2xl border border-line bg-slate-50/70 p-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-extrabold text-ink">
          Situação: {rotuloStatus[emissao.status]}
          {emissao.numeroNfse ? ` · nº ${emissao.numeroNfse}` : ''}
        </p>
        {emissao.ambiente === 'producao_restrita' && (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-900">
            ambiente restrito
          </span>
        )}
      </div>

      {emissao.serie && emissao.numeroDps && (
        <p className="mt-1 text-muted">DPS série {emissao.serie}, número {emissao.numeroDps}.</p>
      )}
      {emissao.canceladoEm && (
        <p className="mt-1 font-semibold text-rose-700">
          Cancelada em {dataHoraBr(emissao.canceladoEm)}
          {emissao.cancelamentoMotivo ? ` — ${emissao.cancelamentoMotivo}` : ''}
        </p>
      )}
      {emissao.status === 'failed' && (emissao.erroMensagem || emissao.erroCodigo) && (
        <p className="mt-1 font-semibold text-rose-700">
          {emissao.erroCodigo ? `${emissao.erroCodigo}: ` : ''}{emissao.erroMensagem}
        </p>
      )}

      {(emissao.eventos?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1 border-t border-line pt-2 text-[11px] text-muted">
          {emissao.eventos?.map((evento) => (
            <li key={`${evento.tipoEvento}-${evento.numeroPedido}`}>
              Evento {evento.tipoEvento} nº {evento.numeroPedido} · {evento.status} ·{' '}
              {dataHoraBr(evento.criadoEm)}{evento.erroMensagem ? ` — ${evento.erroMensagem}` : ''}
            </li>
          ))}
        </ul>
      )}

      {(emissao.danfseDisponivel || emissao.xmlNfseDisponivel || emissao.xmlDpsDisponivel) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
          {emissao.danfseDisponivel && (
            <>
              <a href={urlPdf()} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-psi-deep px-3 py-2 text-[11px] font-extrabold text-white shadow-sm hover:bg-psi-vibrant">
                <Eye className="h-3.5 w-3.5" /> Visualizar NFS-e
              </a>
              <a href={urlPdf(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-psi-vibrant/30 bg-psi-soft/40 px-3 py-2 text-[11px] font-extrabold text-psi-deep hover:bg-psi-soft">
                <Download className="h-3.5 w-3.5" /> Salvar PDF
              </a>
            </>
          )}
          {emissao.xmlNfseDisponivel && (
            <a href={urlXml('nfse')} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[11px] font-extrabold text-ink hover:bg-slate-100">
              <Download className="h-3.5 w-3.5" /> XML da NFS-e
            </a>
          )}
          {emissao.xmlDpsDisponivel && (
            <a href={urlXml('dps')} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[11px] font-bold text-muted hover:bg-slate-100">
              <Download className="h-3.5 w-3.5" /> XML da DPS assinada
            </a>
          )}
        </div>
      )}
    </section>
  );
}

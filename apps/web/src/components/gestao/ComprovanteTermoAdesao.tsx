import React, { useState } from 'react';
import { Download, Loader2, Send } from 'lucide-react';
import type { PsicologoItem } from './types';

type Aceite = NonNullable<PsicologoItem['aceiteTermoAdesao']>;
type Envio = NonNullable<Aceite['envioComprovante']>;

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

export function descreverEnvio(envio: Envio | undefined): string {
  if (!envio) return 'sem registro de envio';
  const quando = DATA_HORA.format(new Date(envio.tentadoEm));
  if (envio.situacao === 'enviada') {
    const para = [envio.paraProfissional && 'profissional', envio.paraClinica && 'clínica'].filter(Boolean).join(' e ');
    return `enviado em ${quando}${para ? ` para ${para}` : ''}`;
  }
  const motivo = {
    destinatario_invalido: 'nenhum e-mail válido',
    provedor_desconfigurado: 'provedor de e-mail desconfigurado',
    falha: envio.detalhe ? `falha — ${envio.detalhe}` : 'falha no provedor',
  }[envio.situacao];
  return `não enviado em ${quando} (${motivo})`;
}

/**
 * Via em PDF do termo aceito: o que foi enviado por e-mail, com download e
 * reenvio para o profissional e a clínica.
 */
export function ComprovanteTermoAdesao({ psicologoId, aceite }: { psicologoId: string; aceite: Aceite }) {
  const [envio, setEnvio] = useState<Envio | undefined>(aceite.envioComprovante);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const url = `/api/application/credenciamento-psicologo/${encodeURIComponent(psicologoId)}/comprovante-termo`;

  async function reenviar() {
    setEnviando(true);
    setErro(null);
    try {
      const resposta = await fetch(url, { method: 'POST' });
      const corpo = (await resposta.json()) as { data?: Envio; error?: string };
      if (corpo.data) setEnvio(corpo.data);
      if (!resposta.ok) setErro(corpo.error ?? 'O comprovante não foi reenviado.');
    } catch {
      setErro('Sem conexão para reenviar o comprovante.');
    } finally {
      setEnviando(false);
    }
  }

  const enviado = envio?.situacao === 'enviada';
  return (
    <div className="space-y-2 border-t border-emerald-100 pt-2">
      <div className="flex items-start justify-between gap-3">
        <span className="font-bold text-slate-500 shrink-0">Via em PDF:</span>
        <span className={`font-semibold text-right ${enviado ? 'text-slate-800' : 'text-amber-800'}`}>
          {descreverEnvio(envio)}
        </span>
      </div>
      {aceite.comprovante && (
        <div className="flex items-start justify-between gap-3">
          <span className="font-bold text-slate-500 shrink-0">SHA-256 do PDF:</span>
          <code className="font-mono text-[10px] text-slate-800 text-right break-all">{aceite.comprovante.sha256}</code>
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2 pt-1">
        <a
          href={url}
          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold text-emerald-800 hover:bg-emerald-50"
        >
          <Download className="w-3.5 h-3.5" /> Baixar PDF
        </a>
        <button
          type="button"
          onClick={reenviar}
          disabled={enviando}
          className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {enviando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {enviado ? 'Reenviar às duas partes' : 'Enviar às duas partes'}
        </button>
      </div>
      {erro && <p role="alert" className="text-[11px] font-semibold text-red-700">{erro}</p>}
    </div>
  );
}

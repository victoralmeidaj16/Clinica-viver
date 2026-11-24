import React from 'react';
import { ChevronDown, FileCheck2, FileWarning } from 'lucide-react';
import type { PsicologoItem } from './types';
import { ComprovanteTermoAdesao } from './ComprovanteTermoAdesao';

const DATA_HORA = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'America/Sao_Paulo',
});

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="font-bold text-slate-500 shrink-0">{rotulo}:</span>
      <span className="font-semibold text-slate-800 text-right break-all">{children}</span>
    </div>
  );
}

/**
 * Prova do aceite do Termo de Adesão, para a gestão consultar em caso de
 * contestação. Cadastros anteriores ao registro no servidor não têm a prova;
 * o card diz isso em vez de mostrar uma data que veio do navegador.
 * Com prova registrada, o card começa recolhido para não alongar a ficha.
 */
export function AceiteTermoAdesaoInfo({ psicologo }: { psicologo: PsicologoItem }) {
  const aceite = psicologo.aceiteTermoAdesao;

  if (!aceite) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <FileWarning aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div className="min-w-0 space-y-0.5">
          <p className="text-xs font-bold text-ink">Sem prova de aceite do Termo de Adesão</p>
          <p className="text-[11px] leading-relaxed text-muted">
            O cadastro foi enviado antes de o servidor passar a registrar o aceite
            {psicologo.versaoTermos ? `; o formulário informou a versão ${psicologo.versaoTermos}` : ''}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <details className="group rounded-2xl border border-slate-200 bg-white text-xs text-slate-600">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-2xl px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-psi-vibrant/40 [&::-webkit-details-marker]:hidden">
        <FileCheck2 aria-hidden className="w-4 h-4 shrink-0 text-emerald-600" />
        <span className="text-xs font-bold text-ink">Aceite do Termo de Adesão</span>
        <span className="ml-auto text-[10px] font-semibold text-slate-500">
          v{aceite.versao} · {DATA_HORA.format(new Date(aceite.aceitoEm))}
        </span>
        <ChevronDown aria-hidden className="w-4 h-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-2 px-4 pb-4">
        <Linha rotulo="Versão aceita">{aceite.versao}</Linha>
        <Linha rotulo="Data e hora (servidor)">{DATA_HORA.format(new Date(aceite.aceitoEm))}</Linha>
        <Linha rotulo="IP">{aceite.ip ?? 'não identificado'}</Linha>
        <Linha rotulo="Navegador">{aceite.navegador ?? 'não informado'}</Linha>
        <Linha rotulo={`Hash do texto (${aceite.hashAlgoritmo})`}>
          {aceite.hashTexto ? (
            <code className="font-mono text-[10px]">{aceite.hashTexto}</code>
          ) : (
            'sem hash: a versão exibida no formulário não era a vigente no servidor'
          )}
        </Linha>
        {aceite.cadeiaIp && (
          <details className="pt-1">
            <summary className="cursor-pointer text-[10px] font-bold text-slate-500">Cabeçalhos de origem</summary>
            <code className="mt-1 block break-all font-mono text-[10px] text-slate-500">{aceite.cadeiaIp}</code>
          </details>
        )}
        <ComprovanteTermoAdesao
          psicologoId={psicologo.id}
          aceite={aceite}
          aprovado={psicologo.status === 'APROVADO'}
        />
      </div>
    </details>
  );
}

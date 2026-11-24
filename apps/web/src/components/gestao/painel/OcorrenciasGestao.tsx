'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertOctagon } from 'lucide-react';
import { chamarGestao } from '@/components/gestao/gestaoApi';
import { DecisaoOcorrenciaForm, type Ocorrencia } from './DecisaoOcorrenciaForm';

const CATEGORIA: Record<string, string> = {
  pedido: 'Pedido', cadastro: 'Cadastro', agenda: 'Agenda', financeiro: 'Pagamento', comunicacao: 'Aviso',
};
const SITUACAO: Record<string, { rotulo: string; classe: string }> = {
  aberta: { rotulo: 'Aberta', classe: 'bg-rose-50 text-rose-800' },
  em_andamento: { rotulo: 'Em andamento', classe: 'bg-amber-50 text-amber-800' },
  resolvida: { rotulo: 'Resolvida', classe: 'bg-emerald-50 text-emerald-800' },
};

/** Ocorrências que precisam de decisão, com abertura da origem e registro da intervenção (13.06). */
export function OcorrenciasGestao() {
  const [itens, setItens] = useState<Ocorrencia[] | null>(null);
  const [verResolvidas, setVerResolvidas] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await chamarGestao<Ocorrencia[]>('/api/application/gestao/ocorrencias'));
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao carregar as ocorrências.');
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const visiveis = (itens ?? []).filter((item) => verResolvidas || item.situacao !== 'resolvida');
  const pendentes = (itens ?? []).filter((item) => item.situacao !== 'resolvida').length;

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-black text-ink">
          <AlertOctagon className="h-4 w-4 text-rose-600" /> Ocorrências para decidir
          <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] text-rose-800">{pendentes}</span>
        </h2>
        <label className="flex items-center gap-2 text-[11px] font-bold text-muted">
          <input type="checkbox" checked={verResolvidas} onChange={(e) => setVerResolvidas(e.target.checked)} /> Mostrar resolvidas
        </label>
      </div>
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
      <ul className="divide-y divide-line rounded-3xl border border-line bg-surface shadow-card">
        {itens && visiveis.length === 0 && <li className="px-4 py-4 text-xs text-muted">Nenhuma ocorrência pendente.</li>}
        {!itens && !erro && <li className="px-4 py-4 text-xs text-muted">Carregando…</li>}
        {visiveis.map((item) => {
          const situacao = SITUACAO[item.situacao];
          return (
            <li key={item.chave} className="space-y-2 px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-extrabold text-ink">
                    <span className="mr-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">{CATEGORIA[item.categoria]}</span>
                    {item.titulo}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{item.descricao}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${situacao.classe}`}>{situacao.rotulo}</span>
                  <Link href={item.href} className="text-[11px] font-bold text-psi-vibrant underline">Abrir origem</Link>
                  <button type="button" onClick={() => setAberta(aberta === item.chave ? null : item.chave)} className="btn-ghost min-h-8 justify-center text-[11px]">
                    Decidir
                  </button>
                </div>
              </div>
              {aberta === item.chave && (
                <DecisaoOcorrenciaForm ocorrencia={item} onRegistrada={(atualizada) => {
                  setItens((atual) => atual?.map((o) => (o.chave === atualizada.chave ? atualizada : o)) ?? null);
                }} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

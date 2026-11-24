'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarRange } from 'lucide-react';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';
import { formatarCelula } from '@/lib/relatorios/areas';

type Periodo = { tipo: 'agora'; em: string } | { tipo: 'intervalo'; desde: string; ate: string };
interface Indicador {
  chave: string; rotulo: string; valor: number; formato: 'numero' | 'moeda'; detalhe?: string; periodo: Periodo; href?: string;
}

function hoje(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function rotuloPeriodo(periodo: Periodo): string {
  if (periodo.tipo === 'agora') return `Agora · ${dataHoraBr(periodo.em)}`;
  const br = (d: string) => d.split('-').reverse().join('/');
  return `${br(periodo.desde)} a ${br(periodo.ate)}`;
}

/** Indicadores principais com o período de cada número identificado (13.04). */
export function PainelIndicadoresGestao() {
  const [ate, setAte] = useState(hoje);
  const [desde, setDesde] = useState(() => `${hoje().slice(0, 8)}01`);
  const [indicadores, setIndicadores] = useState<Indicador[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const dados = await chamarGestao<{ indicadores: Indicador[] }>(
        `/api/application/gestao/painel?${new URLSearchParams({ desde, ate })}`);
      setIndicadores(dados.indicadores);
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao carregar os indicadores.');
    }
  }, [desde, ate]);

  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black text-ink">
          <CalendarRange className="h-4 w-4 text-psi-vibrant" /> Indicadores da clínica
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-bold text-muted">De
            <input type="date" value={desde} max={ate} onChange={(e) => e.target.value && setDesde(e.target.value)}
              className="mt-1 block rounded-xl border border-line bg-white px-2 py-1 text-xs text-ink" />
          </label>
          <label className="text-[11px] font-bold text-muted">Até
            <input type="date" value={ate} min={desde} onChange={(e) => e.target.value && setAte(e.target.value)}
              className="mt-1 block rounded-xl border border-line bg-white px-2 py-1 text-xs text-ink" />
          </label>
        </div>
      </div>
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(indicadores ?? []).map((item) => {
          const conteudo = (
            <>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{item.rotulo}</p>
              <p className="mt-1 text-2xl font-black text-ink">{formatarCelula(item.valor, item.formato === 'moeda' ? 'moeda' : 'numero')}</p>
              {item.detalhe && <p className="mt-1 text-[11px] text-muted">{item.detalhe}</p>}
              <p className="mt-2 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">{rotuloPeriodo(item.periodo)}</p>
            </>
          );
          return item.href ? (
            <Link key={item.chave} href={item.href} className="rounded-3xl border border-line bg-surface p-4 shadow-card transition hover:border-psi-vibrant">{conteudo}</Link>
          ) : (
            <div key={item.chave} className="rounded-3xl border border-line bg-surface p-4 shadow-card">{conteudo}</div>
          );
        })}
        {!indicadores && !erro && <p className="text-xs text-muted">Carregando indicadores…</p>}
      </div>
    </section>
  );
}

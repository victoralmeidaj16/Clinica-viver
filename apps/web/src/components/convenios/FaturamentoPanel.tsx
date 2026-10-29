'use client';

import { useMemo, useState } from 'react';
import { Download, FilePlus2, Loader2 } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import type { ConvenioDetailView, SessaoConvenioView } from './types';
import type { PeriodoFaturamento } from './periodo';
import { FaturaNfsePanel } from './FaturaNfsePanel';
import { SelecaoAtendimentos } from './SelecaoAtendimentos';
import { podeFaturarSessaoConvenio } from '@/lib/convenioBilling';

const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export function FaturamentoPanel({
  detail,
  periodo,
  periodoAplicado,
  loading,
  onPeriodoChange,
  onRefresh,
}: {
  detail: ConvenioDetailView;
  periodo: PeriodoFaturamento;
  periodoAplicado?: PeriodoFaturamento;
  loading: boolean;
  onPeriodoChange: (periodo: PeriodoFaturamento) => void;
  onRefresh: (period?: PeriodoFaturamento) => Promise<void>;
}) {
  // O período é do pai: este painel some da árvore enquanto o detalhe recarrega,
  // e um estado local voltaria ao mês corrente bem no meio de "Aplicar período".
  const { inicio, fim } = periodo;
  const periodoPendente = loading || periodoAplicado?.inicio !== inicio || periodoAplicado?.fim !== fim;
  const setInicio = (valor: string) => onPeriodoChange({ inicio: valor, fim });
  const setFim = (valor: string) => onPeriodoChange({ inicio, fim: valor });
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  // Só entra no boleto empresarial o atendimento que a empresa custeia. Quem
  // paga a própria sessão já tem cobrança individual: incluí-la aqui cobraria
  // o mesmo atendimento duas vezes.
  const sessoesAFaturar = useMemo(
    () => detail.sessoes.filter(podeFaturarSessaoConvenio),
    [detail.sessoes]
  );

  const sessoesIndividuais = useMemo(
    () => detail.sessoes.filter((s) => !s.faturaId && !s.custeadoPelaEmpresa).length,
    [detail.sessoes]
  );

  // A seleção é lembrada junto da lista que a originou. Quando os atendimentos
  // a faturar mudam (outro período, outra fatura fechada), ela volta sozinha a
  // "todos marcados" pela derivação — sem um efeito que renderiza duas vezes.
  const [selecao, setSelecao] = useState<{
    origem: SessaoConvenioView[];
    ids: Set<string>;
  } | null>(null);

  const selectedChargeIds = useMemo(
    () =>
      selecao && selecao.origem === sessoesAFaturar
        ? selecao.ids
        : new Set(sessoesAFaturar.map((s) => s.chargeId)),
    [selecao, sessoesAFaturar]
  );

  const definirSelecao = (ids: Set<string>) => setSelecao({ origem: sessoesAFaturar, ids });

  const toggleSession = (chargeId: string) => {
    const next = new Set(selectedChargeIds);
    if (next.has(chargeId)) {
      next.delete(chargeId);
    } else {
      next.add(chargeId);
    }
    definirSelecao(next);
  };

  const selectAll = () => {
    definirSelecao(new Set(sessoesAFaturar.map((s) => s.chargeId)));
  };

  const deselectAll = () => {
    definirSelecao(new Set());
  };

  const selectedCount = selectedChargeIds.size;
  const totalSelectedCents = useMemo(() => {
    return sessoesAFaturar
      .filter((s) => selectedChargeIds.has(s.chargeId))
      .reduce((acc, s) => acc + s.valorCents, 0);
  }, [sessoesAFaturar, selectedChargeIds]);

  const competencia = inicio.slice(0, 7);

  const close = async () => {
    if (periodoPendente) { setError('Aplique o período antes de fechar a fatura.'); return; }
    if (selectedCount === 0) {
      setError('Selecione ao menos um atendimento para fechar a fatura.');
      return;
    }
    setClosing(true);
    setError('');
    try {
      await applicationRequest(`/convenios/${encodeURIComponent(detail.convenio.id)}/faturas`, {
        method: 'POST',
        headers: commandHeaders(),
        body: JSON.stringify({
          competencia,
          periodoInicio: inicio,
          periodoFim: fim,
          cobrancaRefs: Array.from(selectedChargeIds),
        }),
      });
      await onRefresh({ inicio, fim });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível fechar a fatura.');
    } finally {
      setClosing(false);
    }
  };

  const report = (format: 'csv' | 'pdf') =>
    `/api/application/convenios/${encodeURIComponent(detail.convenio.id)}/relatorio?inicio=${inicio}&fim=${fim}&format=${format}`;

  return (
    <section className="space-y-4 border-t border-psi-soft/70 pt-5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-emerald-700">
          Custeado pela empresa
        </p>
        <h3 className="mt-1 text-base font-black text-ink">Faturamento &amp; Fechamento de Fatura</h3>
        <p className="text-xs text-muted">
          Filtre o período e selecione exatamente quais atendimentos devem compor a fatura desta empresa para emissão de boleto e nota fiscal.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-bold text-ink">
          Início
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="input mt-1 text-xs"
          />
        </label>
        <label className="text-xs font-bold text-ink">
          Fim
          <input
            type="date"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="input mt-1 text-xs"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <button
          type="button"
          onClick={() => void onRefresh({ inicio, fim })}
          className="btn-outline px-3 py-2 text-[11px]"
        >
          Aplicar período
        </button>

        <div className="flex flex-wrap gap-2">
          <a href={report('csv')} className="btn-outline px-3 py-2 text-[11px]">
            <Download className="h-3.5 w-3.5" /> CSV
          </a>
          <a href={report('pdf')} target="_blank" className="btn-outline px-3 py-2 text-[11px]">
            <Download className="h-3.5 w-3.5" /> PDF
          </a>
        </div>
      </div>

      {/* Seleção de atendimentos para a fatura */}
      <div className="rounded-2xl border border-psi-soft/80 bg-slate-50/70 p-4 space-y-3">
        <SelecaoAtendimentos sessoesAFaturar={sessoesAFaturar} sessoesIndividuais={sessoesIndividuais} selectedChargeIds={selectedChargeIds} selectAll={selectAll} deselectAll={deselectAll} toggleSession={toggleSession} />

        {periodoPendente && <p className="text-xs font-bold text-amber-700">Aplique o período para atualizar os atendimentos antes de fechar a fatura.</p>}
        {/* Barra de fechamento */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-line/70">
          <div className="text-xs">
            <span className="font-bold text-ink">
              {selectedCount} de {sessoesAFaturar.length} {selectedCount === 1 ? 'sessão selecionada' : 'sessões selecionadas'}
            </span>
            <span className="text-muted ml-2">
              Total: <strong className="text-emerald-700 font-extrabold">{money(totalSelectedCents)}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={() => void close()}
            disabled={closing || selectedCount === 0 || periodoPendente}
            className="btn-accent px-4 py-2.5 text-xs flex items-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {closing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FilePlus2 className="h-4 w-4" />
            )}
            Fechar fatura ({selectedCount})
          </button>
        </div>
      </div>

      {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}

      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-muted">Histórico de faturas</h4>
        {detail.faturas.map((item) => (
          <FaturaNfsePanel
            key={item.id}
            convenioId={detail.convenio.id}
            fatura={item}
            onRefresh={() => onRefresh({ inicio, fim })}
          />
        ))}
        {detail.faturas.length === 0 && (
          <p className="rounded-2xl border border-dashed border-psi-soft p-5 text-center text-xs text-muted">
            Nenhuma fatura fechada.
          </p>
        )}
      </div>
    </section>
  );
}

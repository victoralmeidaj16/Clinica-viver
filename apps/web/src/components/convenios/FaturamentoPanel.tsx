'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckSquare, Download, FilePlus2, Loader2, Square } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import type { ConvenioDetailView } from './types';
import { FaturaNfsePanel } from './FaturaNfsePanel';

const localDate = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const dateFmt = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));

export function FaturamentoPanel({
  detail,
  onRefresh,
}: {
  detail: ConvenioDetailView;
  onRefresh: (period?: { inicio: string; fim: string }) => Promise<void>;
}) {
  const today = new Date();
  const [inicio, setInicio] = useState(() => localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [fim, setFim] = useState(() => localDate(today));
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState('');

  const sessoesAFaturar = useMemo(
    () => detail.sessoes.filter((s) => !s.faturaId),
    [detail.sessoes]
  );

  const [selectedChargeIds, setSelectedChargeIds] = useState<Set<string>>(
    () => new Set(sessoesAFaturar.map((s) => s.chargeId))
  );

  // Sincroniza seleção quando os atendimentos a faturar mudarem
  useEffect(() => {
    setSelectedChargeIds(new Set(sessoesAFaturar.map((s) => s.chargeId)));
  }, [sessoesAFaturar]);

  const toggleSession = (chargeId: string) => {
    setSelectedChargeIds((prev) => {
      const next = new Set(prev);
      if (next.has(chargeId)) {
        next.delete(chargeId);
      } else {
        next.add(chargeId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedChargeIds(new Set(sessoesAFaturar.map((s) => s.chargeId)));
  };

  const deselectAll = () => {
    setSelectedChargeIds(new Set());
  };

  const selectedCount = selectedChargeIds.size;
  const totalSelectedCents = useMemo(() => {
    return sessoesAFaturar
      .filter((s) => selectedChargeIds.has(s.chargeId))
      .reduce((acc, s) => acc + s.valorCents, 0);
  }, [sessoesAFaturar, selectedChargeIds]);

  const competencia = inicio.slice(0, 7);

  const close = async () => {
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-black text-ink">
              Atendimentos para esta fatura ({sessoesAFaturar.length} disponíveis)
            </h4>
            <p className="text-[11px] text-muted">
              Marque os atendimentos que serão cobrados nesta fatura e nota fiscal.
            </p>
          </div>
          {sessoesAFaturar.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectAll}
                className="text-[11px] font-bold text-psi-deep hover:underline flex items-center gap-1"
              >
                <CheckSquare className="w-3.5 h-3.5" /> Marcar todos
              </button>
              <span className="text-line text-xs">|</span>
              <button
                type="button"
                onClick={deselectAll}
                className="text-[11px] font-bold text-muted hover:text-ink hover:underline flex items-center gap-1"
              >
                <Square className="w-3.5 h-3.5" /> Desmarcar
              </button>
            </div>
          )}
        </div>

        {sessoesAFaturar.length > 0 ? (
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {sessoesAFaturar.map((item) => {
              const isSelected = selectedChargeIds.has(item.chargeId);
              return (
                <label
                  key={item.chargeId}
                  className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition cursor-pointer ${
                    isSelected
                      ? 'border-psi-vibrant/40 bg-white shadow-sm'
                      : 'border-line/60 bg-white/60 hover:bg-white text-muted'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSession(item.chargeId)}
                      className="h-4 w-4 rounded border-line text-psi-vibrant focus:ring-psi-vibrant cursor-pointer"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-ink truncate">{item.pacienteNome}</p>
                      <p className="text-[10px] text-muted">
                        {dateFmt(item.realizadaEm)} · {item.psicologoNome}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-psi-deep whitespace-nowrap">
                    {money(item.valorCents)}
                  </span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="py-4 text-center text-xs text-muted">
            Nenhum atendimento pendente para faturar neste período.
          </p>
        )}

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
            disabled={closing || selectedCount === 0}
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

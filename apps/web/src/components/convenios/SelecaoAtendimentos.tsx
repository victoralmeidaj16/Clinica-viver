'use client';

import { CheckSquare, Square } from 'lucide-react';
import type { SessaoConvenioView } from './types';

const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const dateFmt = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(iso));

export function SelecaoAtendimentos({ sessoesAFaturar, sessoesIndividuais, selectedChargeIds, selectAll, deselectAll, toggleSession }: {
  sessoesAFaturar: SessaoConvenioView[];
  sessoesIndividuais: number;
  selectedChargeIds: Set<string>;
  selectAll: () => void;
  deselectAll: () => void;
  toggleSession: (chargeId: string) => void;
}) {
  return <>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-black text-ink">
              Atendimentos para esta fatura ({sessoesAFaturar.length} disponíveis)
            </h4>
            <p className="text-[11px] text-muted">
              Marque os atendimentos que serão cobrados nesta fatura e nota fiscal.
            </p>
            {sessoesIndividuais > 0 && (
              <p className="text-[11px] font-semibold text-amber-700">
                {sessoesIndividuais}{' '}
                {sessoesIndividuais === 1
                  ? 'atendimento com pagamento atribuído ao paciente ficou'
                  : 'atendimentos com pagamento atribuído ao paciente ficaram'}{' '}
                fora desta fatura. Confira na aba Sessões quais atendimentos estão como pagamento individual.
              </p>
            )}
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

  </>;
}

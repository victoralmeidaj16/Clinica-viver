'use client';

import { ChevronDown, Clock3, Copy, Plus, Trash2, Video } from 'lucide-react';
import { DIAS, DURACOES, quantidadeSlots, type JanelaEditavel } from './availabilityEditorModel';

interface Props {
  dia: number;
  janelas: readonly JanelaEditavel[];
  expandido: boolean;
  padrao: Pick<JanelaEditavel, 'duracaoMin' | 'modalidade'>;
  onExpandir: () => void;
  onAlternar: () => void;
  onAlterar: (indice: number, campo: Partial<JanelaEditavel>) => void;
  onAlterarRegra: (campo: Partial<JanelaEditavel>) => void;
  onAdicionar: () => void;
  onRemover: (indice: number) => void;
  onCopiar: () => void;
}

export function AvailabilityDayCard({
  dia, janelas, expandido, padrao, onExpandir, onAlternar,
  onAlterar, onAlterarRegra, onAdicionar, onRemover, onCopiar,
}: Props) {
  const ativo = janelas.length > 0;
  const duracao = janelas[0]?.duracaoMin ?? padrao.duracaoMin;
  const modalidade = janelas[0]?.modalidade ?? padrao.modalidade;
  const totalSlots = janelas.reduce((total, janela) => total + quantidadeSlots(janela), 0);
  const resumo = ativo ? janelas.map((janela) => `${janela.horaInicio}–${janela.horaFim}`).join(' · ') : 'Sem atendimento';

  return (
    <article className={`overflow-hidden rounded-2xl border transition-all ${expandido ? 'border-psi-vibrant/50 bg-white shadow-lift' : 'border-line bg-white hover:border-psi-vibrant/30'}`}>
      <div className="flex min-h-[74px] items-center gap-3 px-4 sm:px-5">
        <button
          type="button"
          role="switch"
          aria-checked={ativo}
          aria-label={`${ativo ? 'Desativar' : 'Ativar'} atendimento na ${DIAS[dia]}`}
          onClick={onAlternar}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${ativo ? 'bg-psi-deep' : 'bg-slate-200'}`}
        >
          <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${ativo ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>

        <button type="button" onClick={onExpandir} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-ink">{DIAS[dia]}</span>
            <span className={`mt-0.5 block truncate text-xs ${ativo ? 'text-muted' : 'text-slate-400'}`}>{resumo}</span>
          </span>
          {ativo && (
            <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 sm:inline-flex">
              {totalSlots} {totalSlots === 1 ? 'horário' : 'horários'}
            </span>
          )}
          <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${expandido ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {expandido && (
        <div className="border-t border-line bg-canvas/50 px-4 py-4 sm:px-5">
          {!ativo ? (
            <button type="button" onClick={onAlternar} className="btn-outline w-full border-dashed text-xs">
              <Plus className="h-4 w-4" /> Atender neste dia
            </button>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 rounded-xl border border-psi-soft bg-white p-3 sm:grid-cols-2">
                <label className="text-[11px] font-bold text-muted">
                  Duração das sessões
                  <select value={duracao} onChange={(event) => onAlterarRegra({ duracaoMin: Number(event.target.value) })} className="input mt-1 py-2 text-sm font-bold">
                    {DURACOES.map((valor) => <option key={valor} value={valor}>{valor} minutos</option>)}
                  </select>
                </label>
                <label className="text-[11px] font-bold text-muted">
                  Modalidade
                  <select value={modalidade} onChange={(event) => onAlterarRegra({ modalidade: event.target.value as JanelaEditavel['modalidade'] })} className="input mt-1 py-2 text-sm font-bold">
                    <option value="online">Online</option>
                    <option value="presencial">Presencial</option>
                  </select>
                </label>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-muted">Períodos de atendimento</p>
                {janelas.map((janela, indice) => (
                  <div key={`${dia}-${indice}`} className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 rounded-xl border border-line bg-white p-2 sm:max-w-xl">
                    <input aria-label={`Início do período ${indice + 1}`} type="time" value={janela.horaInicio} onChange={(event) => onAlterar(indice, { horaInicio: event.target.value })} className="input min-w-0 py-2 text-sm font-bold" />
                    <span className="text-xs font-bold text-muted">até</span>
                    <input aria-label={`Fim do período ${indice + 1}`} type="time" value={janela.horaFim} onChange={(event) => onAlterar(indice, { horaFim: event.target.value })} className="input min-w-0 py-2 text-sm font-bold" />
                    <button type="button" onClick={() => onRemover(indice)} aria-label={`Remover período ${indice + 1}`} className="rounded-xl p-2.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={onAdicionar} className="btn-outline px-3 py-2 text-xs"><Plus className="h-4 w-4" /> Adicionar período</button>
                  <button type="button" onClick={onCopiar} className="btn-ghost px-3 py-2 text-xs"><Copy className="h-4 w-4" /> Copiar para…</button>
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted">
                  {modalidade === 'online' ? <Video className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                  {totalSlots} horários gerados
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

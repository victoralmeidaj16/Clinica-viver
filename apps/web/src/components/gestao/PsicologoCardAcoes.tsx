import React from 'react';
import { CheckCircle2, XCircle, Edit3, PlayCircle, PauseCircle, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';
import type { PsicologoCardProps } from './PsicologoCard';

type Props = Pick<PsicologoCardProps, 'p' | 'onEditar' | 'onAprovar' | 'onRecusar' | 'onAlternarRodizio' | 'onPriorizar'> & {
  trabalhando: boolean;
  pausado: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
};
const botao = 'text-[11px] font-extrabold px-3 py-1.5 rounded-xl border transition-all disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap';

export function PsicologoCardAcoes({ p, onEditar, onAprovar, onRecusar, onAlternarRodizio, onPriorizar, trabalhando, pausado, expanded, onToggleExpanded }: Props) {
  return (
        <div className="flex items-center gap-2 flex-wrap lg:justify-end shrink-0">
          <button
            disabled={trabalhando}
            onClick={() => onEditar(p)}
            title="Editar cadastro completo"
            className={`${botao} bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100`}
          >
            <Edit3 className="w-3.5 h-3.5 text-purple-700" /> Editar
          </button>

          {p.status === 'EM_ANALISE' ? (
            <>
              <button
                disabled={trabalhando}
                onClick={() => void onAprovar(p)}
                className={`${botao} bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Aprovar
              </button>
              <button
                disabled={trabalhando}
                onClick={() => void onRecusar(p)}
                className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
              >
                <XCircle className="w-3.5 h-3.5" /> Recusar
              </button>
            </>
          ) : p.status === 'RECUSADO' ? (
            <button
              disabled={trabalhando}
              onClick={() => void onAprovar(p)}
              className={`${botao} bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Reconsiderar
            </button>
          ) : (
            <>
              <button
                disabled={trabalhando}
                onClick={() => onAlternarRodizio(p)}
                title={pausado ? 'Volta ao rodízio e à vitrine' : 'Sai do rodízio e da vitrine'}
                className={`${botao} ${
                  pausado
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {pausado ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
                {pausado ? 'Retomar' : 'Pausar'}
              </button>
              {!pausado && (
                <button
                  disabled={trabalhando}
                  onClick={() => void onPriorizar(p)}
                  title="Coloca no início da fila do próximo encaminhamento"
                  className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Priorizar
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onToggleExpanded}
            className="p-2 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-all shrink-0 ml-1"
            title={expanded ? 'Recolher detalhes' : 'Expandir detalhes'}
          >
            {expanded ? <ChevronUp className="w-5 h-5 text-purple-700" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
  );
}

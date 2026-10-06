import React from 'react';
import { AlertTriangle, GraduationCap, RotateCcw, UserX } from 'lucide-react';
import {
  chaveTurma,
  formatarDataCurta,
  normalizarIdentidadeTurma,
  type IdentidadeTurma,
  type TurmaEncerrada,
} from '@/lib/turmaEncerrada';
import { POS_GRADUACOES_VIVER_MAIS } from '@/components/forms/opcoesPsicologo';
import { PsicologoItem } from './types';

interface PainelTurmasProps {
  psicologos: PsicologoItem[];
  encerradas: TurmaEncerrada[];
  ocupado: string | null;
  onEncerrar: (identidade: IdentidadeTurma) => void | Promise<void>;
  onReabrir: (identidade: IdentidadeTurma) => void | Promise<void>;
}

export interface TurmaPainel {
  identidade: IdentidadeTurma;
  quantidade: number;
  administravel: boolean;
  encerramento?: TurmaEncerrada;
}

export interface GrupoTurmasPainel {
  posGraduacao: string;
  turmas: TurmaPainel[];
}

export interface ModeloPainelTurmas {
  grupos: GrupoTurmasPainel[];
  cadastrosIncompletos: number;
  cursosForaCatalogo: number;
}

export function montarModeloPainelTurmas(
  psicologos: readonly PsicologoItem[],
  encerradas: readonly TurmaEncerrada[]
): ModeloPainelTurmas {
  const encerramentoPorChave = new Map(encerradas.map((item) => [chaveTurma(item), item]));
  const turmasPorChave = new Map<string, TurmaPainel>();
  let cadastrosIncompletos = 0;
  let cursosForaCatalogo = 0;

  for (const psicologo of psicologos) {
    if (psicologo.status !== 'APROVADO') continue;
    if (!psicologo.turmaViverMais?.trim() || !psicologo.posGraduacaoViverMais?.trim()) {
      cadastrosIncompletos += 1;
      continue;
    }
    const identidade = normalizarIdentidadeTurma({
      turma: psicologo.turmaViverMais,
      posGraduacao: psicologo.posGraduacaoViverMais,
    });
    const chave = chaveTurma(identidade);
    const existente = turmasPorChave.get(chave);
    if (existente) {
      existente.quantidade += 1;
      continue;
    }
    const administravel = POS_GRADUACOES_VIVER_MAIS.includes(identidade.posGraduacao);
    if (!administravel) cursosForaCatalogo += 1;
    turmasPorChave.set(chave, {
      identidade,
      quantidade: 1,
      administravel,
      encerramento: encerramentoPorChave.get(chave),
    });
  }

  const gruposPorCurso = new Map<string, GrupoTurmasPainel>();
  for (const turma of turmasPorChave.values()) {
    const grupo = gruposPorCurso.get(turma.identidade.posGraduacao) ?? {
      posGraduacao: turma.identidade.posGraduacao,
      turmas: [],
    };
    grupo.turmas.push(turma);
    gruposPorCurso.set(grupo.posGraduacao, grupo);
  }
  const grupos = [...gruposPorCurso.values()].sort((a, b) =>
    a.posGraduacao.localeCompare(b.posGraduacao, 'pt-BR')
  );
  for (const grupo of grupos) {
    grupo.turmas.sort((a, b) => a.identidade.turma.localeCompare(b.identidade.turma, 'pt-BR'));
  }
  return { grupos, cadastrosIncompletos, cursosForaCatalogo };
}

function quantidadePsicologos(quantidade: number): string {
  return `${quantidade} ${quantidade === 1 ? 'psicólogo' : 'psicólogos'}`;
}

export function PainelTurmas(props: PainelTurmasProps) {
  const { psicologos, encerradas, ocupado, onEncerrar, onReabrir } = props;
  const modelo = montarModeloPainelTurmas(psicologos, encerradas);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      <header className="flex flex-col gap-1 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-purple-50 text-purple-700">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Turmas ativas</h2>
            <p className="text-[11px] text-slate-400">Organizadas por pós-graduação e código</p>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">Encerrar retira apenas essa turma da vitrine e do rodízio.</p>
      </header>

      {(modelo.cadastrosIncompletos > 0 || modelo.cursosForaCatalogo > 0) && (
        <div className="mx-5 mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <p>
            {modelo.cadastrosIncompletos > 0 && `${modelo.cadastrosIncompletos} cadastro(s) aprovado(s) sem turma ou pós-graduação completa. `}
            {modelo.cursosForaCatalogo > 0 && `${modelo.cursosForaCatalogo} turma(s) usa(m) um curso legado e precisa(m) de correção.`}
          </p>
        </div>
      )}

      <div className="space-y-4 p-5">
        {modelo.grupos.length === 0 && (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-xs font-semibold text-slate-400">
            Nenhuma turma possui psicólogos aprovados no momento.
          </p>
        )}
        {modelo.grupos.map((grupo) => (
          <div key={grupo.posGraduacao} className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-start justify-between gap-4 bg-slate-50/80 px-4 py-3">
              <h3 className="text-xs font-extrabold leading-relaxed text-slate-800">{grupo.posGraduacao}</h3>
              <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 ring-1 ring-slate-200">
                {grupo.turmas.length} {grupo.turmas.length === 1 ? 'turma' : 'turmas'}
              </span>
            </div>
            <div className="divide-y divide-slate-100">
              {grupo.turmas.map((item) => {
                const { identidade, quantidade, encerramento, administravel } = item;
                const quantos = quantidadePsicologos(quantidade);
                const trabalhando = ocupado === `turma:${chaveTurma(identidade)}`;
                const acao = encerramento ? 'Reabrir' : 'Encerrar turma';
                return (
                  <div key={chaveTurma(identidade)} className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-slate-50/60 sm:flex-row sm:items-center">
                    <span className="w-fit rounded-lg bg-purple-50 px-3 py-1.5 text-sm font-black text-purple-800 ring-1 ring-purple-100">
                      {identidade.turma}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-700">{quantos}</p>
                      {encerramento ? (
                        <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-rose-700">
                          <UserX className="h-3 w-3" /> Encerrada em {formatarDataCurta(encerramento.encerradaEm)}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[10px] font-semibold text-emerald-700">Em curso</p>
                      )}
                    </div>
                    {administravel ? (
                      <button
                        type="button"
                        disabled={trabalhando}
                        onClick={() => {
                          const movimento = encerramento ? 'voltam' : 'saem';
                          if (!confirm(`${acao}: ${identidade.posGraduacao} · ${identidade.turma}? ${quantos} ${movimento} da vitrine e do rodízio.`)) return;
                          void (encerramento ? onReabrir(identidade) : onEncerrar(identidade));
                        }}
                        className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-3 text-[10px] font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 ${
                          encerramento
                            ? 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                            : 'border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                        }`}
                      >
                        {encerramento && <RotateCcw className="h-3 w-3" />}{acao}
                      </button>
                    ) : (
                      <p className="max-w-52 text-[10px] font-semibold leading-relaxed text-amber-700">
                        Corrija o cadastro para administrar esta turma.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import React from 'react';
import { GraduationCap, RotateCcw, UserX } from 'lucide-react';
import { formatarDataCurta, TURMAS_ATIVAS, type TurmaEncerrada } from '@/lib/turmaEncerrada';
import { PsicologoItem } from './types';

interface PainelTurmasProps {
  psicologos: PsicologoItem[];
  encerradas: TurmaEncerrada[];
  ocupado: string | null;
  onEncerrar: (turma: string) => void | Promise<void>;
  onReabrir: (turma: string) => void | Promise<void>;
}

export function posGraduacoesDaTurma(psicologos: readonly PsicologoItem[], turma: string): string[] {
  return [...new Set(
    psicologos
      .filter((psicologo) => psicologo.turmaViverMais === turma && psicologo.status === 'APROVADO')
      .map((psicologo) => psicologo.posGraduacaoViverMais?.trim())
      .filter((nome): nome is string => Boolean(nome))
  )].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/**
 * Turmas em curso e o encerramento de cada uma.
 *
 * Encerrar tira os psicólogos da turma do rodízio e da vitrine na hora;
 * reabrir devolve todos, sem apagar a pausa manual de ninguém.
 */
export function PainelTurmas({ psicologos, encerradas, ocupado, onEncerrar, onReabrir }: PainelTurmasProps) {
  const porTurma = new Map(encerradas.map((item) => [item.turma, item]));

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-purple-600" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Turmas ativas</span>
        </div>
        <p className="text-[11px] text-slate-400">
          Ao encerrar uma turma, os psicólogos dela saem da vitrine e do rodízio.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {TURMAS_ATIVAS.map((turma) => {
          const membros = psicologos.filter((p) => p.turmaViverMais === turma && p.status === 'APROVADO');
          const posGraduacoes = posGraduacoesDaTurma(psicologos, turma);
          const encerramento = porTurma.get(turma);
          const trabalhando = ocupado === `turma:${turma}`;
          const quantos = `${membros.length} ${membros.length === 1 ? 'psicólogo' : 'psicólogos'}`;

          return (
            <div
              key={turma}
              className={`flex h-full flex-col gap-2 rounded-xl border p-3 ${
                encerramento ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-black text-slate-900">{turma}</span>
                <span className="text-[10px] font-bold text-slate-500">{quantos}</span>
              </div>

              <div className="min-h-12 rounded-lg bg-slate-50 px-2.5 py-2">
                <p className="mb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  Pós-graduações
                </p>
                {posGraduacoes.length > 0 ? (
                  <ul className="space-y-1">
                    {posGraduacoes.map((nome) => (
                      <li key={nome} className="break-words text-[10px] font-semibold leading-snug text-slate-700">
                        {nome}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] font-medium text-slate-400">Pós-graduação não informada</p>
                )}
              </div>

              {encerramento ? (
                <p className="text-[10px] font-semibold text-rose-700 flex items-center gap-1">
                  <UserX className="w-3 h-3 shrink-0" /> Encerrada em {formatarDataCurta(encerramento.encerradaEm)}
                </p>
              ) : (
                <p className="text-[10px] font-semibold text-emerald-700">Em curso</p>
              )}

              {encerramento ? (
                <button
                  type="button"
                  disabled={trabalhando}
                  onClick={() => {
                    if (!confirm(`Reabrir a turma ${turma}? ${quantos} voltam à vitrine e ao rodízio.`)) return;
                    void onReabrir(turma);
                  }}
                  className="mt-auto flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-extrabold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" /> Reabrir
                </button>
              ) : (
                <button
                  type="button"
                  disabled={trabalhando}
                  onClick={() => {
                    if (!confirm(`Encerrar a turma ${turma}? ${quantos} saem da vitrine e do rodízio agora.`)) return;
                    void onEncerrar(turma);
                  }}
                  className="mt-auto w-full rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-extrabold text-rose-800 hover:bg-rose-100 disabled:opacity-50"
                >
                  Encerrar turma
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

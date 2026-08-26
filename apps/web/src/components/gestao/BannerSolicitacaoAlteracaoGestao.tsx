'use client';

import React from 'react';
import {
  Bell,
  CheckCircle2,
  XCircle,
  Edit3,
  Sparkles,
  GraduationCap,
  Users,
} from 'lucide-react';
import { PsicologoItem } from './types';

interface BannerSolicitacaoAlteracaoGestaoProps {
  psicologo: PsicologoItem;
  trabalhando: boolean;
  onAprovar: (p: PsicologoItem) => void | Promise<void>;
  onRecusar: (p: PsicologoItem) => void | Promise<void>;
  onEditar: (p: PsicologoItem) => void;
}

export function BannerSolicitacaoAlteracaoGestao({
  psicologo,
  trabalhando,
  onAprovar,
  onRecusar,
  onEditar,
}: BannerSolicitacaoAlteracaoGestaoProps) {
  const solicitacao = psicologo.solicitacaoAlteracaoGestao;
  if (!solicitacao || solicitacao.status !== 'PENDENTE') return null;

  return (
    <div className="rounded-2xl border-2 border-purple-300 bg-purple-50/90 p-4 space-y-3 shadow-xs animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-purple-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-600 text-white rounded-xl shadow-xs">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-black text-purple-950">
              Solicitação de alteração em &ldquo;Definido pela Gestão&rdquo;
            </h4>
            <span className="text-[10px] text-purple-800 font-medium">
              Enviada pelo psicólogo em{' '}
              {new Date(solicitacao.solicitadoEm).toLocaleString('pt-BR', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
          </div>
        </div>

        {/* Ações de Aprovação / Recusa */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            disabled={trabalhando}
            onClick={() => onAprovar(psicologo)}
            className="text-[11px] font-extrabold px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5"
            title="Aprovar e aplicar alterações no perfil do psicólogo"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Aprovar Alteração</span>
          </button>

          <button
            type="button"
            disabled={trabalhando}
            onClick={() => onRecusar(psicologo)}
            className="text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 transition-all disabled:opacity-50 flex items-center gap-1"
            title="Recusar solicitação"
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Recusar</span>
          </button>

          <button
            type="button"
            disabled={trabalhando}
            onClick={() => onEditar(psicologo)}
            className="text-[11px] font-extrabold px-2.5 py-1.5 rounded-xl border border-purple-300 bg-white text-purple-900 hover:bg-purple-100/50 transition-all disabled:opacity-50 flex items-center gap-1"
            title="Editar manualmente na gestão"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
        </div>
      </div>

      {/* Grid de Itens Solicitados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs bg-white/90 p-3 rounded-xl border border-purple-200/60">
        {solicitacao.turmaViverMais && (
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Turma Solicitada:</span>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-slate-400 line-through text-[11px]">
                {psicologo.turmaViverMais ? `Turma ${psicologo.turmaViverMais}` : 'Sem turma'}
              </span>
              <span className="text-purple-700 font-extrabold">→ Turma {solicitacao.turmaViverMais}</span>
            </div>
          </div>
        )}

        {solicitacao.posGraduacaoViverMais && (
          <div className="sm:col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Pós-Graduação Solicitada:</span>
            <div className="text-[11px] text-purple-900 font-bold mt-0.5">
              {solicitacao.posGraduacaoViverMais}
            </div>
          </div>
        )}

        {solicitacao.segundaPosGraduacao && (
          <div className="sm:col-span-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Segunda Pós Solicitada:</span>
            <div className="text-[11px] text-purple-900 font-bold mt-0.5">
              {solicitacao.segundaPosGraduacao}
            </div>
          </div>
        )}

        {solicitacao.limitePacientesAtivos !== undefined && (
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Capacidade Solicitada:</span>
            <div className="flex items-center gap-1 mt-0.5 font-bold">
              <span className="text-slate-400 line-through text-[11px]">
                {psicologo.limitePacientesAtivos ?? 5} pac.
              </span>
              <span className="text-purple-700">→ {solicitacao.limitePacientesAtivos} pacientes ativos</span>
            </div>
          </div>
        )}

        {Boolean(solicitacao.servicosPrestados?.length) && (
          <div className="sm:col-span-2 md:col-span-3 pt-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
              Serviços Solicitados:
            </span>
            <div className="flex flex-wrap gap-1">
              {solicitacao.servicosPrestados?.map((s) => (
                <span
                  key={s}
                  className="text-[10px] font-bold bg-purple-100 text-purple-900 px-2 py-0.5 rounded-md border border-purple-200"
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {solicitacao.justificativa && (
          <div className="sm:col-span-2 md:col-span-3 pt-1 border-t border-purple-100 text-[11px] text-slate-700 italic">
            <strong>Justificativa do profissional:</strong> &ldquo;{solicitacao.justificativa}&rdquo;
          </div>
        )}
      </div>
    </div>
  );
}

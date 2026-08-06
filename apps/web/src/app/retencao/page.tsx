'use client';

import React, { useState } from 'react';
import {
  TrendingDown,
  AlertTriangle,
  UserX,
  RefreshCw,
  PhoneCall,
  CheckCircle2,
  Filter,
  MessageSquare,
  ArrowRightLeft,
} from 'lucide-react';

/** Paciente que interrompeu o acompanhamento e entrou na fila de reengajamento. */
interface Desistencia {
  id: string;
  paciente: string;
  psicologo: string;
  motivo: string;
  descricao: string;
  acaoSugestao: string;
  reengajado: boolean;
}

export default function RetencaoPage() {
  const [desistencias, setDesistencias] = useState<Desistencia[]>([]);

  const handleMarcarReengajado = (id: string) => {
    setDesistencias((prev) =>
      prev.map((item) => (item.id === id ? { ...item, reengajado: true } : item))
    );
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header */}
      <div>
        <span className="chip-accent text-[11px] mb-1">Qualidade & Retenção de Pacientes</span>
        <h1 className="text-2xl font-black text-ink flex items-center gap-2">
          <TrendingDown className="w-6 h-6 text-rose-500" />
          Auditoria de Desistências & Reengajamento
        </h1>
        <p className="text-xs text-muted">
          Identifique as causas de abandono do tratamento, avalie a conduta clínica e execute reengajamento estratégico.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Total de Desistências</span>
            <h3 className="text-2xl font-black text-rose-600 mt-1">2 Pacientes</h3>
          </div>
          <div className="p-3 bg-rose-100 text-rose-700 rounded-2xl">
            <UserX className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Motivo Predominante</span>
            <h3 className="text-2xl font-black text-ink mt-1">Motivo Financeiro (50%)</h3>
          </div>
          <div className="p-3 bg-amber-100 text-amber-700 rounded-2xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-surface p-5 rounded-3xl border border-line shadow-card flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-muted">Taxa de Reengajamento</span>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">50% Sucesso</h3>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Lista de Fila de Auditoria */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line">
          <h3 className="font-extrabold text-base text-ink">Fila de Ação de Reengajamento & Controle de Qualidade</h3>
          <p className="text-xs text-muted">Acompanhe os feedbacks dos pacientes desistentes para tomada de decisão</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Psicólogo</th>
                <th className="px-6 py-4">Motivo da Saída</th>
                <th className="px-6 py-4">Detalhes da Abordagem</th>
                <th className="px-6 py-4">Ação Sugerida</th>
                <th className="px-6 py-4 text-right">Status / Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {desistencias.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-ink">{item.paciente}</td>
                  <td className="px-6 py-4 font-bold text-psi-vibrant">{item.psicologo}</td>
                  <td className="px-6 py-4">
                    <span className="bg-rose-100 text-rose-800 text-[10px] font-extrabold px-2.5 py-1 rounded-full border border-rose-200">
                      {item.motivo}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted max-w-xs">{item.descricao}</td>
                  <td className="px-6 py-4 font-semibold text-slate-700">{item.acaoSugestao}</td>
                  <td className="px-6 py-4 text-right">
                    {item.reengajado ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Reengajado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleMarcarReengajado(item.id)}
                        className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-bold text-xs px-3.5 py-1.5 rounded-xl shadow-md transition-all inline-flex items-center gap-1"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        Contatar Paciente
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

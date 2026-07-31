'use client';

import React from 'react';
import { FileText, Lock, ShieldCheck, Download, Search, Calendar } from 'lucide-react';

export default function ProntuariosPage() {
  const prontuariosMock = [
    {
      id: 'SOAP-2026-001',
      paciente: 'Mariana Silva de Oliveira',
      data: '29/07/2026 às 14:30',
      tipo: 'Consulta Individual',
      status: 'Aprovado & Criptografado',
      hash: 'e2b6fbef007f46c29340193a1250c0e1',
    },
    {
      id: 'SOAP-2026-002',
      paciente: 'Lucas Ramos Oliveira',
      data: '28/07/2026 às 16:30',
      tipo: 'Consulta Individual',
      status: 'Aprovado & Criptografado',
      hash: 'a571f900192848c29340193a1250c0f9',
    },
    {
      id: 'SOAP-2026-003',
      paciente: 'Beatriz Santos Guimarães',
      data: '27/07/2026 às 10:00',
      tipo: 'Consulta Individual',
      status: 'Aprovado & Criptografado',
      hash: 'c881fa22001948c29340193a1250c0aa',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="chip-capri text-[11px] mb-1">Guarda Regulatória de 5 Anos (CFP)</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Prontuários SOAP Armazenados
          </h1>
          <p className="text-xs text-muted">
            Histórico completo de evoluções clínicas encriptadas no Cloud Firestore.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-surface px-3 py-1.5 rounded-xl border border-line">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-bold text-ink">Encriptação em Repouso AES-256</span>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
            <input
              type="text"
              placeholder="Filtrar por nome do paciente ou código..."
              className="input text-xs pl-9 py-2"
            />
          </div>
          <span className="text-xs text-muted font-medium">{prontuariosMock.length} prontuários registrados</span>
        </div>

        <div className="space-y-3">
          {prontuariosMock.map((item) => (
            <div key={item.id} className="p-4 rounded-xl border border-line bg-canvas/40 flex items-center justify-between hover:bg-white transition-all">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-ink">{item.paciente}</span>
                    <span className="text-[10px] font-mono bg-soft text-muted px-2 py-0.5 rounded">{item.id}</span>
                  </div>
                  <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
                    <Calendar className="w-3 h-3 text-primary" />
                    <span>{item.data}</span>
                    <span>•</span>
                    <span className="font-mono text-[10px] text-slate-400">SHA-256: {item.hash.substring(0, 16)}...</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="chip text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                  {item.status}
                </span>
                <button className="btn-ghost text-xs p-2" title="Exportar Prontuário PDF">
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

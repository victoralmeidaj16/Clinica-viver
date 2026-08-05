'use client';

import React from 'react';
import { X, Lock, ShieldCheck, Download, Printer, UserCheck, Calendar, Hash } from 'lucide-react';
import { SoapRecordItem } from './NewSoapRecordModal';

interface ViewSoapRecordModalProps {
  record: SoapRecordItem | null;
  onClose: () => void;
  onExportPdf: (record: SoapRecordItem) => void;
}

export default function ViewSoapRecordModal({ record, onClose, onExportPdf }: ViewSoapRecordModalProps) {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-3xl shadow-2xl p-6 space-y-6 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-ink p-1">
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-psi-darkest text-white flex items-center justify-center font-bold shadow-md">
              <Lock className="w-6 h-6 text-psi-vibrant" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-ink">{record.paciente}</h3>
                <span className="chip-dark text-[10px] font-mono">{record.id}</span>
              </div>
              <p className="text-xs text-muted flex items-center gap-2 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-psi-deep" />
                <span>{record.data}</span>
                <span>•</span>
                <span>{record.tipo}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onExportPdf(record)}
              className="btn-accent py-2 px-3 text-xs flex items-center gap-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar PDF</span>
            </button>
            <button
              onClick={() => window.print()}
              className="btn-outline py-2 px-3 text-xs flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          </div>
        </div>

        {/* Informações Regulatórias */}
        <div className="bg-psi-light border border-psi-soft rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-psi-darkest font-semibold">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Encriptado em Repouso — Guarda de 5 anos obrigatória (CFP N.º 01/2009)</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-mono text-muted">
            <Hash className="w-3 h-3" />
            <span>SHA-256: {record.hash}</span>
          </div>
        </div>

        {/* 4 Pilares SOAP */}
        <div className="space-y-4 text-xs">
          {/* Subjetivo */}
          <div className="card bg-white p-4 space-y-1.5 border border-line">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-psi-vibrant text-white font-mono text-[11px] font-bold flex items-center justify-center">S</span>
              <h4 className="font-extrabold text-ink uppercase tracking-wider text-[11px]">Subjetivo (Relato do Paciente)</h4>
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-line pl-7">
              {record.subjective}
            </p>
          </div>

          {/* Objetivo */}
          <div className="card bg-white p-4 space-y-1.5 border border-line">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-psi-deep text-white font-mono text-[11px] font-bold flex items-center justify-center">O</span>
              <h4 className="font-extrabold text-ink uppercase tracking-wider text-[11px]">Objetivo (Observações Clínicas & Escalas)</h4>
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-line pl-7">
              {record.objective}
            </p>
          </div>

          {/* Avaliação */}
          <div className="card bg-white p-4 space-y-1.5 border border-line">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-psi-darkest text-white font-mono text-[11px] font-bold flex items-center justify-center">A</span>
              <h4 className="font-extrabold text-ink uppercase tracking-wider text-[11px]">Avaliação (Formulação e Hipóteses Clínicas)</h4>
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-line pl-7">
              {record.assessment}
            </p>
          </div>

          {/* Plano */}
          <div className="card bg-white p-4 space-y-1.5 border border-line">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[11px] font-bold flex items-center justify-center">P</span>
              <h4 className="font-extrabold text-ink uppercase tracking-wider text-[11px]">Plano (Conduta & Próximos Passos)</h4>
            </div>
            <p className="text-ink leading-relaxed whitespace-pre-line pl-7">
              {record.plan}
            </p>
          </div>
        </div>

        {/* Assinatura do Profissional */}
        <div className="pt-4 border-t border-line flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-psi-soft flex items-center justify-center font-bold text-psi-darkest">
              <UserCheck className="w-4 h-4 text-psi-deep" />
            </div>
            <div>
              <p className="font-extrabold text-ink">Dra. Camila Vasconcelos</p>
              <p className="text-[10px] text-muted">CRP 06/148293 • Psicóloga Responsável</p>
            </div>
          </div>

          <button onClick={onClose} className="btn-primary text-xs py-2 px-4">
            Fechar Prontuário
          </button>
        </div>
      </div>
    </div>
  );
}

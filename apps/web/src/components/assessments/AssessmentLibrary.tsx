'use client';

import React, { useState } from 'react';
import { isSupportedAssessmentCode, PSYCHOMETRIC_CATALOG } from '@thats-life/core';
import { ClipboardList, Search, Send, ArrowRight } from 'lucide-react';

interface AssessmentLibraryProps {
  onSendToPatient: (instrumentCode: string, channel: 'app' | 'whatsapp') => void;
}

export default function AssessmentLibrary({ onSendToPatient }: AssessmentLibraryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDomain, setSelectedDomain] = useState<string>('TCC');

  const filteredInstruments = PSYCHOMETRIC_CATALOG.filter((inst) => {
    const matchesSearch =
      inst.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inst.purpose.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedDomain === 'TCC') return inst.isTccRecommended;
    if (selectedDomain === 'TODOS') return true;
    return inst.domain === selectedDomain;
  });

  const domainTabs = [
    { id: 'TCC', label: '⭐ Recomendados TCC' },
    { id: 'Ansiedade', label: 'Ansiedade' },
    { id: 'Depressão', label: 'Depressão' },
    { id: 'Estresse', label: 'Estresse' },
    { id: 'TDAH', label: 'TDAH' },
    { id: 'TOC', label: 'TOC' },
    { id: 'Risco de Suicídio', label: 'Risco Suicídio' },
    { id: 'TODOS', label: 'Ver Todos (17 Domínios)' },
  ];

  return (
    <div className="card space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-line pb-4">
        <div>
          <h2 className="text-base font-extrabold text-ink flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-primary" />
            Biblioteca de Questionários & Escalas Padronizadas ({PSYCHOMETRIC_CATALOG.length} Instrumentos)
          </h2>
          <p className="text-xs text-muted">
            Filtre por abordagem clínica (TCC), transtorno ou busque por sigla.
          </p>
        </div>

        {/* Busca por Texto */}
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar DASS-21, ASRS, Y-BOCS..."
            className="input text-xs pl-9 py-2"
          />
        </div>
      </div>

      {/* Abas de Navegação por Domínio Clínico */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
        {domainTabs.map((tab) => {
          const isActive = selectedDomain === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedDomain(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-canvas text-muted hover:text-ink hover:bg-soft'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grid de Escalas Filtradas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredInstruments.map((inst) => {
          const hasDemoPreview = isSupportedAssessmentCode(inst.code);
          return (
          <div
            key={inst.code}
            className={`p-3.5 rounded-xl border space-y-2.5 transition-all ${
              inst.isHighRiskProtocol
                ? 'bg-rose-50/60 border-rose-300'
                : 'bg-canvas/40 border-line hover:bg-white'
            }`}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="font-bold text-xs text-primary">{inst.code}</span>
                  {inst.isTccRecommended && (
                    <span className="chip-accent text-[9px] py-0 px-1.5">TCC</span>
                  )}
                  {inst.isHighRiskProtocol && (
                    <span className="chip bg-rose-200 text-rose-900 border-rose-400 text-[9px] py-0 px-1.5">
                      Risco Alto
                    </span>
                  )}
                </div>
                <h3 className="font-extrabold text-xs text-ink leading-tight">{inst.title}</h3>
              </div>
            </div>

            <p className="text-[11px] text-muted leading-snug line-clamp-2">{inst.purpose}</p>

            <div className="flex items-center justify-between text-[10px] text-muted pt-1 border-t border-line">
              <span>{inst.itemsCount} itens</span>
              <span className="font-medium text-slate-700">{inst.applicationMode}</span>
            </div>

            {/* Ações */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => onSendToPatient(inst.code, 'app')}
                disabled={!hasDemoPreview}
                className="btn-primary text-[11px] py-1.5 px-2 flex-1 justify-center"
              >
                <Send className="w-3 h-3" />
                <span>{hasDemoPreview ? 'Prévia App' : 'Em validação'}</span>
              </button>

              <button
                onClick={() => onSendToPatient(inst.code, 'whatsapp')}
                disabled
                className="btn-outline text-[11px] py-1.5 px-2 flex-1 justify-center"
              >
                <span>WhatsApp indisponível</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

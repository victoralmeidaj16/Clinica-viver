'use client';

import React, { useState } from 'react';
import { Sparkles, Check, BookOpen, FileText } from 'lucide-react';

interface AiClinicalInterpreterProps {
  onImportToSoap: (draftText: string) => void;
}

export default function AiClinicalInterpreter({ onImportToSoap }: AiClinicalInterpreterProps) {
  const [copied, setCopied] = useState(false);

  const draftText = `Aplicação de acompanhamento do PHQ-9 e GAD-7 em 29/07/2026: Pontuação PHQ-9 = 7 (Depressão Leve) e GAD-7 = 5 (Ansiedade Leve). Observa-se evolução altamente favorável com redução de 61% nos sintomas em relação ao escore inicial (Baseline PHQ-9 = 18). Indicado manter o protocolo TCC para Ativação Comportamental e RPD diário.`;

  const handleCopy = () => {
    onImportToSoap(draftText);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="card bg-gradient-to-br from-purple-950 via-primary-dark to-slate-900 text-white space-y-4 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          <h3 className="text-base font-extrabold text-white">Interpretação Assistida por IA & Protocolos Clínicos</h3>
        </div>
        <span className="chip bg-white/10 text-white border-white/20 text-[10px]">Conteúdo demonstrativo</span>
      </div>

      {/* Análise Sintética */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-purple-200 uppercase tracking-wide">Síntese Diagnóstica Longitudinal</p>
        <p className="text-xs text-white/90 leading-relaxed font-sans bg-white/5 p-3 rounded-xl border border-white/10">
          {draftText}
        </p>
      </div>

      {/* Recomendações Baseadas em Protocolos (TCC / ACT) */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-purple-200 flex items-center gap-1">
          <BookOpen className="w-3.5 h-3.5 text-amber-400" />
          Recomendações de Protocolos Baseados em Evidências
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="font-bold text-amber-300">TCC — Ativação Comportamental</span>
            <p className="text-[11px] text-white/70 mt-0.5">Manutenção do RPD para identificação de distorções de desvalia.</p>
          </div>
          <div className="bg-white/5 p-2.5 rounded-xl border border-white/10">
            <span className="font-bold text-capri">ACT — Terapia de Aceitação</span>
            <p className="text-[11px] text-white/70 mt-0.5">Exercícios de desfusão cognitiva para ruídos corporativos.</p>
          </div>
        </div>
      </div>

      {/* Botão de Importação pro SOAP */}
      <div className="pt-2">
        <button
          onClick={handleCopy}
          className="w-full btn-accent py-3 text-xs justify-center gap-2 shadow-md"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-white" />
              <span>Prévia copiada localmente</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 text-white" />
              <span>Simular cópia para o campo Avaliação do SOAP</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

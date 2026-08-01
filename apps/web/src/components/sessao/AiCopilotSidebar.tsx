'use client';

import React, { useState } from 'react';
import { Bot, Sparkles, FileText, AlertTriangle, Lightbulb, CheckCircle2, Loader2, X } from 'lucide-react';

interface AiCopilotSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  sessionDurationSeconds: number;
}

export function AiCopilotSidebar({ isOpen, onClose, sessionDurationSeconds }: AiCopilotSidebarProps) {
  const [activePrompt, setActivePrompt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiOutput, setAiOutput] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTriggerAction = (actionType: string, label: string) => {
    setActivePrompt(label);
    setIsGenerating(true);
    setAiOutput(null);

    // Simulação de geração de resposta da IA em tempo real com base no áudio capturado
    setTimeout(() => {
      setIsGenerating(false);
      if (actionType === 'summary') {
        setAiOutput(
          '**Resumo dos primeiros minutos:** Paciente relata aumento da ansiedade noturna após mudança de cargo no trabalho. Menciona dificuldades para conciliar o sono e pensamentos de insuficiência.'
        );
      } else if (actionType === 'risk') {
        setAiOutput(
          '**Análise de Indicadores:** Nenhum indicador de risco agudo identificado até o momento. Nível de estresse moderado a alto.'
        );
      } else if (actionType === 'hypothesis') {
        setAiOutput(
          '**Hipóteses Psicoterapêuticas (TCC):** Crença central de desvalor impulsionada por alta autoexigência. Recomenda-se investigar distorções cognitivas do tipo "tudo ou nada".'
        );
      } else {
        setAiOutput('**Intervenção Sugerida:** Questionamento socrático sobre as evidências da suposta incompetência profissional relatada.');
      }
    }, 1200);
  };

  return (
    <aside className="w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-30 shadow-2xl animate-in slide-in-from-right-5 duration-200">
      {/* Header do Copiloto */}
      <div className="h-14 px-5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Bot className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Copiloto Clínico de IA</h3>
            <p className="text-[10px] text-slate-400">Análise em tempo real • Transcrição ativa</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Painel de Triggers em 1-Clique */}
        <div>
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
            Ações Rápidas de IA
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleTriggerAction('summary', 'Resumo Parcial')}
              className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all group"
            >
              <FileText className="w-4 h-4 text-indigo-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-slate-200 block">Resumo Parcial</span>
              <span className="text-[10px] text-slate-400">Síntese do relato até aqui</span>
            </button>

            <button
              onClick={() => handleTriggerAction('risk', 'Pontos de Atenção')}
              className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all group"
            >
              <AlertTriangle className="w-4 h-4 text-amber-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-slate-200 block">Indicadores</span>
              <span className="text-[10px] text-slate-400">Sinais de alerta/estresse</span>
            </button>

            <button
              onClick={() => handleTriggerAction('hypothesis', 'Hipóteses (TCC)')}
              className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all group"
            >
              <Sparkles className="w-4 h-4 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-slate-200 block">Hipóteses</span>
              <span className="text-[10px] text-slate-400">Formulação psicoterapêutica</span>
            </button>

            <button
              onClick={() => handleTriggerAction('intervention', 'Intervenção')}
              className="p-3 bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 rounded-xl text-left transition-all group"
            >
              <Lightbulb className="w-4 h-4 text-purple-400 mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-medium text-slate-200 block">Intervenção</span>
              <span className="text-[10px] text-slate-400">Sugestão de pergunta/técnica</span>
            </button>
          </div>
        </div>

        {/* Resposta Gerada pela IA */}
        {isGenerating && (
          <div className="p-4 bg-slate-950/60 border border-indigo-500/30 rounded-xl flex items-center space-x-3 text-indigo-300">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span className="text-xs font-medium">Processando transcrição acumulada...</span>
          </div>
        )}

        {aiOutput && !isGenerating && (
          <div className="p-4 bg-slate-950 border border-indigo-500/20 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-400">{activePrompt}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xs text-slate-300 leading-relaxed font-sans prose prose-invert">
              {aiOutput}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

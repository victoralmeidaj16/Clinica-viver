'use client';

import React, { useState } from 'react';
import { Sparkles, FileText, CheckCircle2, User, Clock } from 'lucide-react';
import { type ReviewSession } from '@/lib/postSessionApi';

interface ClinicalSynthesisInputProps {
  sessions: ReviewSession[];
  selectedSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onGenerateSoap: () => void;
  isProcessing: boolean;
}

export default function ClinicalSynthesisInput({
  sessions,
  selectedSessionId,
  onSelectSession,
  onGenerateSoap,
  isProcessing,
}: ClinicalSynthesisInputProps) {
  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId) ?? sessions[0];
  const [synthesisText, setSynthesisText] = useState('');

  return (
    <div className="card space-y-5 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 text-white p-6 rounded-3xl border border-slate-800 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-psi-vibrant/20 border border-psi-vibrant/40 flex items-center justify-center text-psi-light">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-base text-white">Síntese Clínica da Sessão</h3>
            <p className="text-xs text-slate-400">Seleção do paciente e pontos de atenção para estruturação SOAP automatizada</p>
          </div>
        </div>
        <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 self-start sm:self-auto">
          <Sparkles className="w-3.5 h-3.5" /> IA SOAP Ativa
        </span>
      </div>

      {/* Seleção do Paciente */}
      <div className="space-y-2">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
          Paciente em Atendimento Pós-Sessão
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {sessions.map((session) => {
            const isSelected = session.sessionId === selectedSessionId;
            return (
              <button
                key={session.sessionId}
                type="button"
                onClick={() => onSelectSession(session.sessionId)}
                className={`p-3.5 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-psi-vibrant/20 border-psi-vibrant text-white shadow-lg shadow-psi-vibrant/10'
                    : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-extrabold text-sm">
                    <User className="w-4 h-4 text-psi-light" />
                    <span>{session.patientName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{new Date(session.scheduledStart).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
                {isSelected && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Campo de Anotações/Síntese */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
            Anotações Clínicas / Síntese do Psicólogo
          </label>
          <span className="text-[11px] text-slate-400">Pontos chaves abordados no atendimento</span>
        </div>
        <textarea
          rows={3}
          value={synthesisText}
          onChange={(e) => setSynthesisText(e.target.value)}
          placeholder={`Ex: Paciente ${selectedSession?.patientName ?? ''} relatou melhora na ansiedade social durante a semana... (opcional para personalizar o SOAP)`}
          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-psi-vibrant focus:ring-1 focus:ring-psi-vibrant transition-all resize-none"
        />
      </div>

      {/* Ação de Geração em 1 Clique */}
      <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs text-slate-400">
          O motor de IA gera o prontuário estruturado no padrão CFP/LGPD instantaneamente.
        </p>
        <button
          type="button"
          onClick={onGenerateSoap}
          disabled={isProcessing}
          className="w-full sm:w-auto bg-gradient-to-r from-psi-vibrant to-emerald-600 hover:from-psi-vibrant/90 hover:to-emerald-500 text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl transition-all shadow-lg shadow-psi-vibrant/30 flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {isProcessing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Gerando Prontuário SOAP...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Gerar Prontuário SOAP em 1 Clique</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

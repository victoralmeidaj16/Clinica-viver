'use client';

import React, { useState } from 'react';
import { ShieldCheck, Video, Mic, ArrowRight } from 'lucide-react';

interface ConsentOverlayProps {
  patientName: string;
  onConsentGranted: () => void;
}

export function ConsentOverlay({ patientName, onConsentGranted }: ConsentOverlayProps) {
  const [consentRecording, setConsentRecording] = useState(true);
  const [consentAi, setConsentAi] = useState(true);

  const handleStart = () => {
    if (consentRecording && consentAi) {
      onConsentGranted();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100">Iniciar Sessão de Psicologia</h2>
          <p className="text-xs text-slate-400">
            Sessão com <span className="font-semibold text-slate-200">{patientName}</span>
          </p>
        </div>

        <div className="space-y-4 bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentRecording}
              onChange={(e) => setConsentRecording(e.target.checked)}
              className="mt-1 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-200 block">Consentimento de Áudio e Vídeo</span>
              <span className="text-slate-400">
                Autorizo a transmissão em tempo real para fins de atendimento psicológico telepresencial.
              </span>
            </div>
          </label>

          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={consentAi}
              onChange={(e) => setConsentAi(e.target.checked)}
              className="mt-1 rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500"
            />
            <div className="text-xs">
              <span className="font-semibold text-slate-200 block">Processamento Clínico por IA (AssemblyAI)</span>
              <span className="text-slate-400">
                Autorizo a transcrição criptografada e anonimizada em conformidade com CFP e LGPD.
              </span>
            </div>
          </label>
        </div>

        <button
          onClick={handleStart}
          disabled={!consentRecording || !consentAi}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center space-x-2"
        >
          <span>Entrar na Sala & Iniciar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

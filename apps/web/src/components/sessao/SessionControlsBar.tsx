'use me';
// Client component for video controls bar
'use client';

import React from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Bot, Layout, Maximize2, Shield } from 'lucide-react';

interface SessionControlsBarProps {
  isMicOn: boolean;
  isCameraOn: boolean;
  isCopilotOpen: boolean;
  isRecordingActive: boolean;
  recordingTimeSeconds: number;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleCopilot: () => void;
  onEndSession: () => void;
}

export function SessionControlsBar({
  isMicOn,
  isCameraOn,
  isCopilotOpen,
  isRecordingActive,
  recordingTimeSeconds,
  onToggleMic,
  onToggleCamera,
  onToggleCopilot,
  onEndSession,
}: SessionControlsBarProps) {
  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-16 bg-slate-900 border-t border-slate-800 px-6 flex items-center justify-between shadow-2xl z-30">
      {/* Indicador de Status & Gravação Silenciosa */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
          <span className={`w-2.5 h-2.5 rounded-full ${isRecordingActive ? 'bg-red-500 animate-pulse' : 'bg-amber-500'}`} />
          <span className="text-xs font-mono text-slate-200">
            {isRecordingActive ? `SESSÃO AO VIVO • ${formatTime(recordingTimeSeconds)}` : 'AGUARDANDO CONEXÃO'}
          </span>
        </div>
        <div className="hidden sm:flex items-center space-x-1 text-emerald-400 text-xs bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/40">
          <Shield className="w-3.5 h-3.5" />
          <span>Criptografia E2E + CFP Compliant</span>
        </div>
      </div>

      {/* Controles Principais estilo Zoom */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMic}
          className={`p-3 rounded-full transition-all duration-200 ${
            isMicOn ? 'bg-slate-800 hover:bg-slate-700 text-slate-100' : 'bg-red-600/90 hover:bg-red-600 text-white animate-bounce-once'
          }`}
          title={isMicOn ? 'Mutar Microfone' : 'Ativar Microfone'}
        >
          {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        <button
          onClick={onToggleCamera}
          className={`p-3 rounded-full transition-all duration-200 ${
            isCameraOn ? 'bg-slate-800 hover:bg-slate-700 text-slate-100' : 'bg-red-600/90 hover:bg-red-600 text-white'
          }`}
          title={isCameraOn ? 'Desligar Câmera' : 'Ligar Câmera'}
        >
          {isCameraOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        <div className="h-6 w-px bg-slate-700 my-auto" />

        {/* Trigger do Copiloto de IA */}
        <button
          onClick={onToggleCopilot}
          className={`flex items-center space-x-2 px-4 py-2.5 rounded-full font-medium text-sm transition-all duration-200 ${
            isCopilotOpen
              ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 ring-2 ring-indigo-400'
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`}
        >
          <Bot className="w-4 h-4 text-indigo-400" />
          <span>Copiloto de IA</span>
        </button>

        <button
          onClick={onEndSession}
          className="flex items-center space-x-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold text-sm rounded-full transition-all duration-200 shadow-lg shadow-red-600/20"
        >
          <PhoneOff className="w-4 h-4" />
          <span>Encerrar Sessão</span>
        </button>
      </div>
    </div>
  );
}

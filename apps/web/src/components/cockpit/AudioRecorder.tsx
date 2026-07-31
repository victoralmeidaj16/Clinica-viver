'use client';

import React, { useState, useEffect } from 'react';
import { Mic, Square, Upload, Sparkles, Clock, UserCheck } from 'lucide-react';
import type { ReviewSession } from '@/lib/postSessionApi';

interface AudioRecorderProps {
  sessions: ReviewSession[];
  selectedSessionId: string;
  onSelectSession: (sessionId: string) => void;
  onGenerateSoap: () => void;
  isProcessing: boolean;
}

export default function AudioRecorder({
  sessions,
  selectedSessionId,
  onSelectSession,
  onGenerateSoap,
  isProcessing,
}: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [hasAudioRecorded, setHasAudioRecorded] = useState(false);

  useEffect(() => {
    if (!isRecording) return;

    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRecording]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleToggleRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      setHasAudioRecorded(true);
    } else {
      setSeconds(0);
      setIsRecording(true);
      setHasAudioRecorded(false);
    }
  };

  const handleSimulateUpload = () => {
    setSeconds(245); // 4min 05s
    setHasAudioRecorded(true);
  };

  const selectedSession = sessions.find((item) => item.sessionId === selectedSessionId) ?? sessions[0];

  return (
    <div className="card space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h2 className="text-lg font-extrabold text-ink flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            1. Gravador / Entrada de Áudio da Sessão
          </h2>
          <p className="text-xs text-muted mt-0.5">
            Grave o atendimento ao vivo ou importe um arquivo de áudio para estruturação automática por IA.
          </p>
        </div>

        {/* Seleção do Paciente */}
        <div className="flex items-center gap-2 bg-soft px-3 py-1.5 rounded-xl border border-line">
          <UserCheck className="w-4 h-4 text-primary" />
          <select
            value={selectedSessionId}
            onChange={(e) => onSelectSession(e.target.value)}
            className="bg-transparent text-xs font-bold text-ink focus:outline-none cursor-pointer"
          >
            {sessions.map((session) => (
              <option key={session.sessionId} value={session.sessionId}>
                {session.patientName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Interface Central de Gravação */}
      <div className="bg-canvas/70 border border-line rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Espectro visual quando gravando */}
        {isRecording && (
          <div className="flex items-center gap-1 my-4">
            {[40, 70, 30, 90, 60, 100, 50, 80, 45, 95, 60, 30, 85].map((h, i) => (
              <span
                key={i}
                className="w-1.5 bg-primary/70 rounded-full animate-pulse"
                style={{
                  height: `${h}px`,
                  animationDuration: `${0.6 + (i % 3) * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}

        {/* Timer */}
        <div className="flex items-center gap-2 text-2xl font-black font-mono text-ink my-2">
          <Clock className={`w-5 h-5 ${isRecording ? 'text-coral animate-spin' : 'text-muted'}`} />
          <span>{isRecording ? formatTime(seconds) : hasAudioRecorded ? '04:05' : '00:00'}</span>
        </div>

        {/* Status */}
        <p className="text-xs font-semibold text-muted mb-4">
          {isRecording
            ? 'Gravando áudio da sessão em alta fidelidade...'
            : hasAudioRecorded
            ? 'Áudio de atendimento pronto para processamento por IA.'
            : 'Clique em "Iniciar Gravação" ou importe um arquivo de mídia.'}
        </p>

        {/* Botões de Ação da Gravação */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleToggleRecord}
            className={`btn ${
              isRecording
                ? 'bg-coral hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-md'
                : 'btn-primary'
            }`}
          >
            {isRecording ? (
              <>
                <Square className="w-4 h-4 fill-white" />
                <span>Finalizar Gravação</span>
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                <span>Iniciar Gravação Ao Vivo</span>
              </>
            )}
          </button>

          {!isRecording && (
            <button onClick={handleSimulateUpload} className="btn-outline text-xs py-3">
              <Upload className="w-4 h-4" />
              <span>Importar Áudio Existente</span>
            </button>
          )}
        </div>
      </div>

      {/* Botão de Disparo da IA SOAP */}
      <div className="pt-2">
        <button
          onClick={onGenerateSoap}
          disabled={isRecording || isProcessing}
          className="w-full btn-accent text-base py-3.5 shadow-md flex items-center justify-center gap-3"
        >
          <Sparkles className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
          <span>
            {isProcessing
              ? 'Processando Áudio & Carregando Prontuário SOAP...'
              : `Abrir rascunho SOAP de ${selectedSession?.patientName.split(' ')[0] ?? 'paciente'} ⚡`}
          </span>
        </button>
      </div>
    </div>
  );
}

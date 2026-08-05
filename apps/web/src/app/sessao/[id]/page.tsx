'use client';

import React, { useState } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { ZoomVideoGrid } from '@/components/sessao/ZoomVideoGrid';
import { SessionControlsBar } from '@/components/sessao/SessionControlsBar';
import { AiCopilotSidebar } from '@/components/sessao/AiCopilotSidebar';
import { ConsentOverlay } from '@/components/sessao/ConsentOverlay';
import { useMediaRecorderSession } from '@/hooks/useMediaRecorderSession';
import { useWebRtcPeer } from '@/hooks/useWebRtcPeer';

export default function SessionPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = (params?.id as string) || 'sessao-demo';
  const roleParam = searchParams?.get('role');
  const isPatientRole = roleParam === 'patient';

  const [hasConsented, setHasConsented] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isCopilotOpen, setIsCopilotOpen] = useState(!isPatientRole);

  const { isRecording, recordingSeconds, startSessionMedia, stopSessionMedia } =
    useMediaRecorderSession();

  // Integração WebRTC P2P real entre abas/dispositivos
  const { localStream, remoteStream, isConnected } = useWebRtcPeer({
    roomId: sessionId,
    isHost: !isPatientRole,
  });

  const handleConsentGranted = () => {
    setHasConsented(true);
    startSessionMedia();
  };

  const handleEndSession = async () => {
    stopSessionMedia();
    if (!isPatientRole) {
      try {
        await fetch(`/api/application/sessions/${sessionId}/end`, {
          method: 'POST',
          headers: { 'x-user-id': 'user-demo' },
        });
      } catch (err) {
        console.warn('Falha ao registrar encerramento da sessão no servidor:', err);
      }
    }
    router.push(isPatientRole ? '/' : '/cockpit');
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      {!hasConsented && (
        <ConsentOverlay
          patientName={isPatientRole ? 'Dra. Mariana Souza' : 'Lucas Andrade'}
          onConsentGranted={handleConsentGranted}
        />
      )}

      {/* Banner de status do participante conectado */}
      <div className="h-6 bg-slate-900 border-b border-slate-800/60 px-4 flex items-center justify-between text-[11px]">
        <div className="flex items-center space-x-2">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
          <span className="text-slate-300 font-mono">
            {isConnected ? 'PARTICIPANTE CONECTADO VIA WEBRTC' : 'AGUARDANDO 2º PARTICIPANTE... (ABRA EM OUTRA ABA)'}
          </span>
        </div>
        <div className="text-slate-400 font-mono">
          SALA ID: <span className="text-indigo-400 font-bold">{sessionId}</span> {isPatientRole ? '(VISÃO PACIENTE)' : '(VISÃO PSICÓLOGO)'}
        </div>
      </div>

      {/* Área Principal de Atendimento */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Grid de Vídeo Zoom-Like (2 Pessoas) */}
        <ZoomVideoGrid
          localStream={localStream}
          remoteStream={remoteStream}
          patientName="Lucas Andrade"
          professionalName="Dra. Mariana Souza"
          isLocalMicOn={isMicOn}
          isLocalCameraOn={isCameraOn}
        />

        {/* Copiloto de IA Lateral (Apenas para o Psicólogo) */}
        {!isPatientRole && (
          <AiCopilotSidebar
            isOpen={isCopilotOpen}
            onClose={() => setIsCopilotOpen(false)}
            sessionId={sessionId}
            sessionDurationSeconds={recordingSeconds}
          />
        )}
      </div>

      {/* Barra de Controles Inferior estilo Zoom */}
      <SessionControlsBar
        isMicOn={isMicOn}
        isCameraOn={isCameraOn}
        isCopilotOpen={isCopilotOpen}
        isRecordingActive={isRecording}
        recordingTimeSeconds={recordingSeconds}
        onToggleMic={() => setIsMicOn(!isMicOn)}
        onToggleCamera={() => setIsCameraOn(!isCameraOn)}
        onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
        onEndSession={handleEndSession}
      />
    </div>
  );
}

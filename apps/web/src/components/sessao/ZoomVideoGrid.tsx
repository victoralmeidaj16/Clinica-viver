'use client';

import React from 'react';
import { DraggableParticipantCard } from './DraggableParticipantCard';

interface ZoomVideoGridProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  patientName: string;
  professionalName: string;
  isLocalMicOn: boolean;
  isLocalCameraOn: boolean;
}

export function ZoomVideoGrid({
  localStream,
  remoteStream,
  patientName,
  professionalName,
  isLocalMicOn,
  isLocalCameraOn,
}: ZoomVideoGridProps) {
  return (
    <div className="relative flex-1 bg-slate-950 overflow-hidden select-none">
      {/* Background Decorativo da Sala */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900/60 via-slate-950 to-slate-950 pointer-events-none" />

      {/* Janela 1: Paciente (Posição padrão principal) */}
      <DraggableParticipantCard
        participantName={patientName}
        roleLabel="Paciente"
        isLocal={false}
        videoStream={remoteStream || localStream} // Fallback local para demonstração/dev
        isMuted={false}
        isVideoOff={false}
        initialPosition={{ x: 30, y: 30 }}
      />

      {/* Janela 2: Psicólogo / Profissional (Posição flutuante secundária) */}
      <DraggableParticipantCard
        participantName={professionalName}
        roleLabel="Psicólogo(a)"
        isLocal={true}
        videoStream={localStream}
        isMuted={!isLocalMicOn}
        isVideoOff={!isLocalCameraOn}
        initialPosition={{ x: 500, y: 30 }}
      />
    </div>
  );
}

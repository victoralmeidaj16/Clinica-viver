'use client';

import React, { useState, useRef } from 'react';
import { Maximize2, Minimize2, Mic, MicOff, Move, User } from 'lucide-react';

interface DraggableParticipantCardProps {
  participantName: string;
  roleLabel: string;
  isLocal: boolean;
  videoStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  initialPosition?: { x: number; y: number };
}

export function DraggableParticipantCard({
  participantName,
  roleLabel,
  isLocal,
  videoStream,
  isMuted,
  isVideoOff,
  initialPosition = { x: 20, y: 20 },
}: DraggableParticipantCardProps) {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 440, height: 280 });
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number }>({ startX: 0, startY: 0, posX: 0, posY: 0 });
  const videoRef = useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    }
  }, [videoStream]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      posX: position.x,
      posY: position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - dragRef.current.startX;
      const dy = moveEvent.clientY - dragRef.current.startY;
      setPosition({
        x: Math.max(10, dragRef.current.posX + dx),
        y: Math.max(10, dragRef.current.posY + dy),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  return (
    <div
      style={
        isMaximized
          ? { position: 'absolute', top: 12, left: 12, right: 12, bottom: 12, zIndex: 20 }
          : {
              position: 'absolute',
              top: `${position.y}px`,
              left: `${position.x}px`,
              width: `${size.width}px`,
              height: `${size.height}px`,
              zIndex: isDragging ? 30 : 10,
            }
      }
      className={`rounded-2xl bg-slate-900 border border-slate-700/60 shadow-2xl overflow-hidden flex flex-col transition-all duration-150 group ${
        isDragging ? 'cursor-grabbing border-indigo-500 shadow-indigo-500/10' : ''
      }`}
    >
      {/* Header com Handle de Arraste e Controles de Tamanho */}
      <div
        onMouseDown={handleMouseDown}
        className="h-10 bg-slate-950/70 backdrop-blur-md px-4 flex items-center justify-between cursor-grab border-b border-slate-800/60 select-none"
      >
        <div className="flex items-center space-x-2">
          <Move className="w-3.5 h-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />
          <span className="text-xs font-semibold text-slate-200">{participantName}</span>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
            {roleLabel}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {isMuted && <MicOff className="w-3.5 h-3.5 text-red-400" />}
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:bg-slate-800 text-slate-300 rounded transition-colors"
            title={isMaximized ? 'Restaurar tamanho' : 'Maximizar janela'}
          >
            {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Área de Vídeo / Fallback */}
      <div className="flex-1 bg-slate-950 relative flex items-center justify-center overflow-hidden">
        {isVideoOff || !videoStream ? (
          <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
            <div className="w-16 h-16 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
              <User className="w-8 h-8 text-slate-400" />
            </div>
            <span className="text-xs text-slate-400">Câmera Desligada</span>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted={isLocal}
            className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
          />
        )}

        {/* Badge do Nome e Estado */}
        <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-2.5 py-1 rounded-lg flex items-center space-x-2">
          <span className="text-xs text-slate-200 font-medium">{participantName}</span>
          {isLocal && <span className="text-[10px] text-indigo-400 font-mono">(Você)</span>}
        </div>
      </div>
    </div>
  );
}

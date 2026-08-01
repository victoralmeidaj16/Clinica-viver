'use client';

import React, { useState, useEffect, useRef } from 'react';

export function useMediaRecorderSession() {
  const [isRecording, setIsRecording] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startSessionMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setLocalStream(stream);
      setIsRecording(true);

      // Inicia timer de gravação
      timerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);

      // Instancia MediaRecorder em background para captura de áudio silenciada (AssemblyAI)
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioOnlyStream = new MediaStream([audioTrack]);
        const recorder = new MediaRecorder(audioOnlyStream, { mimeType: 'audio/webm' });
        mediaRecorderRef.current = recorder;
        recorder.start(5000); // Chunks a cada 5 segundos
      }
    } catch (err) {
      console.warn('Câmera/Microfone não concedidos ou mock fallback necessário:', err);
    }
  };

  const stopSessionMedia = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      stopSessionMedia();
    };
  }, []);

  return {
    isRecording,
    localStream,
    recordingSeconds,
    startSessionMedia,
    stopSessionMedia,
  };
}

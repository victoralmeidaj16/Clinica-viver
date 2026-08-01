'use client';

import { useState, useEffect, useRef } from 'react';

export interface UseWebRtcPeerOptions {
  roomId: string;
  isHost: boolean; // true = psicologo, false = paciente
}

export function useWebRtcPeer({ roomId, isHost }: UseWebRtcPeerOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerId, setPeerId] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    // Configuração de ICE servers públicos (STUN do Google)
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;

    const currentPeerId = isHost ? `host-${roomId}` : `peer-${roomId}`;
    setPeerId(currentPeerId);

    // Canal de sinalização WebRTC simples via BroadcastChannel (Web API nativa, zero servidor extra)
    const channelName = `tl-psi-signaling-${roomId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    // Escuta tracks remotos do parceiro
    pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
        setIsConnected(true);
      }
    };

    // Inicializa câmera local
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        // Envia candidatos ICE
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channel.postMessage({
              type: 'ice-candidate',
              senderId: currentPeerId,
              candidate: event.candidate,
            });
          }
        };

        // Se for o Host (psicólogo), gera e envia a Offer inicial
        if (isHost) {
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer))
            .then(() => {
              channel.postMessage({
                type: 'offer',
                senderId: currentPeerId,
                offer: pc.localDescription,
              });
            })
            .catch((err) => setError('Erro ao criar offer WebRTC: ' + err.message));
        } else {
          // Se for o Paciente, sinaliza que entrou na sala para solicitar re-offer se necessário
          channel.postMessage({ type: 'join', senderId: currentPeerId });
        }
      })
      .catch((err) => {
        setError('Não foi possível acessar a câmera/microfone: ' + err.message);
      });

    // Mensagens de sinalização recebidas
    channel.onmessage = async (event) => {
      const { type, senderId, offer, answer, candidate } = event.data;
      if (senderId === currentPeerId) return;

      try {
        if (type === 'join' && isHost) {
          // Paciente acabou de entrar, recria a Offer
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          channel.postMessage({
            type: 'offer',
            senderId: currentPeerId,
            offer: pc.localDescription,
          });
        } else if (type === 'offer' && !isHost) {
          // Paciente recebe a offer do psicólogo e responde com Answer
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answerDesc = await pc.createAnswer();
          await pc.setLocalDescription(answerDesc);
          channel.postMessage({
            type: 'answer',
            senderId: currentPeerId,
            answer: pc.localDescription,
          });
        } else if (type === 'answer' && isHost) {
          // Psicólogo recebe a resposta do paciente
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } else if (type === 'ice-candidate') {
          // Troca de candidatos de rede
          if (candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      } catch (e: any) {
        console.warn('Erro na sinalização WebRTC:', e);
      }
    };

    return () => {
      pc.close();
      channel.close();
    };
  }, [roomId, isHost]);

  return {
    localStream,
    remoteStream,
    peerId,
    isConnected,
    error,
  };
}

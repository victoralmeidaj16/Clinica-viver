import {
  resolveSpeakerRoles,
  type RawTranscript,
  type RecordingReference,
  type SpeakerMapping,
  type TranscriptionProviderPort,
  type TranscriptionReference,
} from '@thats-life/core';
import { getDemoTranscript } from '../demo/sessionTranscript';

/**
 * Adaptador de transcrição em modo demonstração.
 *
 * O áudio não é enviado a nenhum fornecedor: as falas vêm do transcript de
 * demonstração. Tudo o que acontece depois é real — a diarização é a do core
 * (`resolveSpeakerRoles`, com calibração pela abertura da profissional) e o
 * texto resultante é o que a IA recebe para redigir o rascunho SOAP.
 *
 * Um adaptador de produção implementa a mesma porta chamando AssemblyAI,
 * Whisper ou equivalente, e nada além deste arquivo precisa mudar.
 */

export interface ResolvedTranscript {
  readonly id: string;
  readonly sessionId: string;
  readonly organizationId: string;
  readonly text: string;
  readonly mapping: SpeakerMapping;
  readonly producedAt: string;
}

interface TranscriptGlobal {
  __thatsLifeTranscripts?: Map<string, ResolvedTranscript>;
}
const globalScope = globalThis as typeof globalThis & TranscriptGlobal;

function transcripts(): Map<string, ResolvedTranscript> {
  if (!globalScope.__thatsLifeTranscripts) {
    globalScope.__thatsLifeTranscripts = new Map();
  }
  return globalScope.__thatsLifeTranscripts;
}

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Serializa a transcrição já com os papéis resolvidos. É este texto — e não a
 * lista bruta de locutores — que vai para o prompt clínico, de modo que a IA
 * nunca precise adivinhar quem falou o quê.
 */
export function renderTranscriptText(
  transcript: RawTranscript,
  mapping: SpeakerMapping
): string {
  return transcript.utterances
    .map((utterance) => {
      const role =
        utterance.speaker === mapping.patientSpeakerId
          ? 'Paciente'
          : utterance.speaker === mapping.professionalSpeakerId
            ? 'Profissional'
            : 'Locutor não identificado';
      return `[${formatTimestamp(utterance.start)}] ${role}: ${utterance.text}`;
    })
    .join('\n');
}

export function buildDemoTranscription(input: {
  organizationId: string;
  sessionId: string;
  patientId: string;
  producedAt?: string;
}): ResolvedTranscript {
  const demo = getDemoTranscript(input.patientId);
  const transcript: RawTranscript = {
    id: `transcription-${input.sessionId}`,
    status: 'completed',
    text: demo.utterances.map((u) => u.text).join(' '),
    utterances: [...demo.utterances],
  };

  const mapping = resolveSpeakerRoles(transcript.utterances, {
    professionalIntroEndMs: demo.professionalIntroEndMs,
  });

  const resolved: ResolvedTranscript = {
    id: transcript.id,
    sessionId: input.sessionId,
    organizationId: input.organizationId,
    text: renderTranscriptText(transcript, mapping),
    mapping,
    producedAt: input.producedAt ?? new Date().toISOString(),
  };

  transcripts().set(resolved.id, resolved);
  return resolved;
}

export function getResolvedTranscript(transcriptionId: string): ResolvedTranscript | undefined {
  return transcripts().get(transcriptionId);
}

export function createDemoTranscriptionProvider(
  resolvePatientId: (sessionId: string) => string
): TranscriptionProviderPort {
  return {
    async transcribe(input: {
      organizationId: string;
      sessionId: string;
      recording: RecordingReference;
      language: 'pt-BR';
    }): Promise<TranscriptionReference> {
      const resolved = buildDemoTranscription({
        organizationId: input.organizationId,
        sessionId: input.sessionId,
        patientId: resolvePatientId(input.sessionId),
      });

      return {
        id: resolved.id,
        recordingId: input.recording.id,
        producedAt: resolved.producedAt,
        providerReference: 'demo-transcription/diarizacao-local',
      };
    },
  };
}

export interface RawUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
}

export interface RawTranscript {
  id: string;
  text: string;
  utterances: RawUtterance[];
  status: 'completed' | 'error' | 'processing';
}

export type SpeakerRole = 'professional' | 'patient' | 'unknown';

export interface SpeakerMapping {
  professionalSpeakerId: string;
  patientSpeakerId: string;
  confidence: 'calibrated' | 'heuristic' | 'ambiguous';
}

export interface SpeakerCalibration {
  professionalIntroEndMs: number;
}

export function resolveSpeakerRoles(
  utterances: readonly RawUtterance[],
  calibration?: SpeakerCalibration
): SpeakerMapping {
  if (!utterances || utterances.length === 0) {
    return {
      professionalSpeakerId: 'A',
      patientSpeakerId: 'B',
      confidence: 'ambiguous',
    };
  }

  const speakers = Array.from(new Set(utterances.map((u) => u.speaker)));
  if (speakers.length !== 2) {
    return {
      professionalSpeakerId: speakers[0] || 'A',
      patientSpeakerId: speakers[1] || 'B',
      confidence: 'ambiguous',
    };
  }

  if (calibration && calibration.professionalIntroEndMs > 0) {
    const introUtterances = utterances.filter(
      (u) => u.start <= calibration.professionalIntroEndMs
    );
    if (introUtterances.length > 0) {
      const speakerCounts: Record<string, number> = {};
      for (const u of introUtterances) {
        speakerCounts[u.speaker] = (speakerCounts[u.speaker] || 0) + (u.end - u.start);
      }
      let dominantSpeaker = speakers[0];
      let maxDuration = 0;
      for (const [spk, dur] of Object.entries(speakerCounts)) {
        if (dur > maxDuration) {
          maxDuration = dur;
          dominantSpeaker = spk;
        }
      }
      const otherSpeaker = speakers.find((s) => s !== dominantSpeaker) || 'B';
      return {
        professionalSpeakerId: dominantSpeaker,
        patientSpeakerId: otherSpeaker,
        confidence: 'calibrated',
      };
    }
  }

  return {
    professionalSpeakerId: speakers[0],
    patientSpeakerId: speakers[1],
    confidence: 'ambiguous',
  };
}

export function buildTranscriptDerivedDraft(
  transcript: RawTranscript,
  mapping: SpeakerMapping
): {
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
  tarefasExtraidas: string[];
} {
  const patientUtterances = transcript.utterances.filter(
    (u) => u.speaker === mapping.patientSpeakerId
  );

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `[${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}]`;
  };

  const subjetivoText = patientUtterances.length > 0
    ? patientUtterances
        .map((u) => `${formatTime(u.start)} Paciente: ${u.text}`)
        .join('\n')
    : transcript.text || 'Nenhuma fala direta de paciente identificada no áudio.';

  const totalDurationMs = transcript.utterances.length > 0
    ? transcript.utterances[transcript.utterances.length - 1].end
    : 0;

  const totalTurns = transcript.utterances.length;

  return {
    subjetivo: subjetivoText.slice(0, 4000),
    objetivo: `Transcrição de áudio processada. Duração estimada: ${Math.round(totalDurationMs / 1000)}s. Turnos de fala identificados: ${totalTurns}. Confiança na diarização: ${mapping.confidence}. Sinais não audíveis não são observáveis na fonte e não foram registrados.`,
    avaliacao: `[PENDENTE DE REDAÇÃO PROFISSIONAL] Análise clínica em elaboração baseada na sessão transcrita.`,
    plano: `[PENDENTE DE REDAÇÃO PROFISSIONAL] Plano terapêutico e encaminhamentos a definir com o paciente.`,
    tarefasExtraidas: [],
  };
}

/**
 * Política de retenção da plataforma.
 *
 * Três janelas distintas, deliberadamente diferentes entre si:
 *
 * - Áudio da sessão: 72h. Existe apenas para permitir reprocessar a
 *   transcrição em caso de falha; não é acervo.
 * - Transcrição: 90 dias. Janela para o profissional retificar o prontuário
 *   com a fonte à mão.
 * - Prontuário aprovado: 5 anos, conforme exigência do CFP.
 *
 * Estes valores estavam espalhados por rotas e seeds, com a janela da
 * transcrição aplicada por engano ao prontuário. Ficam centralizados aqui.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function addFrom(iso: string, deltaMs: number): string {
  const base = Date.parse(iso);
  const from = Number.isNaN(base) ? Date.now() : base;
  return new Date(from + deltaMs).toISOString();
}

export const RECORDING_RETENTION = {
  hours: 72,
  until: (capturedAt: string): string => addFrom(capturedAt, 72 * HOUR_MS),
} as const;

export const TRANSCRIPTION_RETENTION = {
  days: 90,
  until: (producedAt: string): string => addFrom(producedAt, 90 * DAY_MS),
} as const;

export const CLINICAL_RECORD_RETENTION = {
  years: 5,
  until: (createdAt: string): string => addFrom(createdAt, 5 * 365 * DAY_MS),
} as const;

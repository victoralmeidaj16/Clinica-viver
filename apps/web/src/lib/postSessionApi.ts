import { applicationRequest, commandHeaders } from './applicationApi';

export interface ReviewSessionDraft {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  extractedTasks: string[];
}

export interface ReviewSession {
  sessionId: string;
  status: string;
  patientId: string;
  patientName: string;
  scheduledStart: string;
  recordId?: string;
  draftContent?: ReviewSessionDraft;
}

export interface PostSessionRequest {
  content: ReviewSessionDraft;
  handoff: { summary: string; tasks: string[]; nextSessionLabel?: string };
  shareWithPatient: boolean;
  charge: { amountCents: number; dueAt: string };
  notifyPatient: boolean;
  occurredAt: string;
}

export interface PostSessionResult {
  sessionId: string;
  status: string;
  completed: boolean;
  recordId: string;
  approvedRevisionNumber?: number;
  contentHashSha256: string;
  timelineEntries: number;
  handoffTasks: number;
  chargeId?: string;
  receiptId?: string;
  notificationId?: string;
  failedStep?: { step: string; errorCode: string; message: string };
}

export function fetchReviewSessions(): Promise<ReviewSession[]> {
  return applicationRequest<ReviewSession[]>('/sessions');
}

/** Encerra a sessão e gera a minuta SOAP a partir da síntese revisável. */
export function endSessionAndGenerateDraft(
  sessionId: string,
  synthesis: string
): Promise<{ sessionId: string; status: string; recordId: string }> {
  return applicationRequest(`/sessions/${sessionId}/end`, {
    method: 'POST',
    headers: commandHeaders(),
    body: JSON.stringify({ synthesis }),
  });
}

/**
 * Dispara a automação pós-sessão. A chave de idempotência é gerada por comando,
 * então um segundo clique acidental reproduz o mesmo resultado em vez de emitir
 * uma nova cobrança ou uma nova mensagem ao paciente.
 */
export function runPostSession(
  sessionId: string,
  body: PostSessionRequest
): Promise<PostSessionResult> {
  return applicationRequest<PostSessionResult>(
    `/sessions/${sessionId}/post-session`,
    { method: 'POST', headers: commandHeaders(), body: JSON.stringify(body) }
  );
}

export function fetchPreSessionBriefing(appointmentId: string): Promise<unknown> {
  return applicationRequest<unknown>(`/appointments/${appointmentId}/briefing`);
}

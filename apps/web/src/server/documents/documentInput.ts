import { DOCUMENT_PURPOSES, type PsychologicalDocumentInput } from '@thats-life/core';
import { ApplicationError } from '@/server/application/http';

function text(value: unknown, label: string, max = 200): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) {
    throw new ApplicationError('INVALID_INPUT', `Preencha ${label} (até ${max} caracteres).`, 400);
  }
  return value.trim();
}

function date(value: unknown): string {
  const result = text(value, 'uma data válida', 10);
  const parsed = new Date(`${result}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    throw new ApplicationError('INVALID_INPUT', 'Informe uma data válida.', 400);
  }
  return result;
}

export function parseDocumentInput(body: Record<string, unknown>): PsychologicalDocumentInput {
  if (!body || !['attendance', 'followup', 'referral'].includes(String(body.kind))) {
    throw new ApplicationError('INVALID_INPUT', 'Selecione um modelo de documento.', 400);
  }
  const kind = body.kind as PsychologicalDocumentInput['kind'];
  const base = { kind, location: text(body.location, 'local do atendimento e emissão'), purpose: '' };
  if (kind === 'referral') return {
    ...base, recipient: text(body.recipient, 'destinatário'),
    requester: text(body.requester, 'solicitante'),
    demand: text(body.demand, 'descrição da demanda', 2000),
    procedures: text(body.procedures, 'procedimentos', 2000),
    analysis: text(body.analysis, 'análise', 4000),
    conclusion: text(body.conclusion, 'conclusão e encaminhamento', 2000),
  };
  const purpose = text(body.purpose, 'finalidade');
  if (!(DOCUMENT_PURPOSES as readonly string[]).includes(purpose)) throw new ApplicationError('INVALID_INPUT', 'Selecione uma finalidade válida.', 400);
  if (kind === 'attendance') return { ...base, purpose, appointmentId: text(body.appointmentId, 'atendimento', 128) };
  const startDate = date(body.startDate);
  const endDate = date(body.endDate);
  if (startDate > endDate) throw new ApplicationError('INVALID_INPUT', 'O fim do período deve ser posterior ao início.', 400);
  return { ...base, purpose, startDate, endDate };
}

import { ApplicationError } from './http';
import type { PostSessionInput } from './postSessionService';

function record(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApplicationError('INVALID_BODY', `${field} deve ser um objeto.`, 400);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ApplicationError('INVALID_BODY', `${field} é obrigatório.`, 400);
  }
  return value;
}

function isoDate(value: unknown, field: string): string {
  const parsed = text(value, field);
  if (Number.isNaN(Date.parse(parsed))) {
    throw new ApplicationError('INVALID_BODY', `${field} deve ser uma data ISO válida.`, 400);
  }
  return parsed;
}

function textList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) {
    throw new ApplicationError('INVALID_BODY', `${field} deve ser uma lista.`, 400);
  }
  return value.map((item, index) => text(item, `${field}[${index}]`));
}

function positiveCents(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new ApplicationError('INVALID_BODY', `${field} deve ser um inteiro positivo em centavos.`, 400);
  }
  return value;
}

/**
 * Fronteira de entrada do fluxo de 1 clique. O corpo chega do browser, portanto
 * nada é assumido: campos ausentes ou com tipo errado viram erro de contrato
 * antes que qualquer regra de domínio seja executada.
 */
export function parsePostSessionInput(body: Record<string, unknown>): PostSessionInput {
  const content = record(body.content, 'content');
  const handoff = record(body.handoff, 'handoff');
  const charge = record(body.charge, 'charge');
  const shareWithPatient = body.shareWithPatient !== false;

  return {
    content: {
      subjective: text(content.subjective, 'content.subjective'),
      objective: text(content.objective, 'content.objective'),
      assessment: text(content.assessment, 'content.assessment'),
      plan: text(content.plan, 'content.plan'),
      extractedTasks: textList(content.extractedTasks ?? [], 'content.extractedTasks'),
    },
    handoff: {
      summary: shareWithPatient ? text(handoff.summary, 'handoff.summary') : '',
      tasks: textList(handoff.tasks ?? [], 'handoff.tasks'),
      nextSessionLabel:
        typeof handoff.nextSessionLabel === 'string' && handoff.nextSessionLabel.trim()
          ? handoff.nextSessionLabel
          : undefined,
    },
    shareWithPatient,
    charge: {
      amountCents: positiveCents(charge.amountCents, 'charge.amountCents'),
      dueAt: isoDate(charge.dueAt, 'charge.dueAt'),
    },
    notifyPatient: body.notifyPatient !== false,
    occurredAt: isoDate(body.occurredAt ?? new Date().toISOString(), 'occurredAt'),
  };
}

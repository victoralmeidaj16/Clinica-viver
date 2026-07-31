export type PatientHandoffStatus = 'draft' | 'approved' | 'delivered';

export interface PatientHandoffTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface PatientHandoff {
  schemaVersion: 1;
  patientId: string;
  sessionId: string;
  summary: string;
  tasks: PatientHandoffTask[];
  nextSessionLabel?: string;
  professionalName: string;
  status: PatientHandoffStatus;
  humanReviewRequired: true;
  safetyWarnings: string[];
  approvedBy?: string;
  approvedAt?: string;
  deliveredAt?: string;
}

export interface CreatePatientHandoffInput {
  patientId: string;
  sessionId: string;
  summary: string;
  tasks: readonly string[];
  nextSessionLabel?: string;
  professionalName: string;
}

const RESTRICTED_CONTENT = [
  {
    label: 'referência a conteúdo interno do prontuário',
    pattern: /\b(?:soap|prontu[aá]rio|nota cl[ií]nica)\b/i,
  },
  {
    label: 'hipótese ou conclusão diagnóstica',
    pattern: /\b(?:hip[oó]tese diagn[oó]stica|diagn[oó]stico|progn[oó]stico)\b/i,
  },
  {
    label: 'conteúdo de risco que exige comunicação humana direta',
    pattern: /\b(?:idea[çc][aã]o suicida|suic[ií]dio|autoles[aã]o|risco cl[ií]nico)\b/i,
  },
  {
    label: 'CPF',
    pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/,
  },
  {
    label: 'e-mail',
    pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
  },
];

function assertNonEmpty(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} é obrigatório.`);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function reviewPatientHandoffContent(
  summary: string,
  tasks: readonly string[]
): string[] {
  const warnings = new Set<string>();
  const normalizedSummary = normalizeText(summary);
  const allContent = [normalizedSummary, ...tasks.map(normalizeText)];

  if (normalizedSummary.length < 40) {
    warnings.add('O resumo precisa ter ao menos 40 caracteres.');
  }
  if (normalizedSummary.length > 600) {
    warnings.add('O resumo deve ter no máximo 600 caracteres.');
  }
  if (tasks.length > 8) {
    warnings.add('Selecione no máximo 8 tarefas para o paciente.');
  }

  for (const content of allContent) {
    for (const restricted of RESTRICTED_CONTENT) {
      if (restricted.pattern.test(content)) {
        warnings.add(`Remova ${restricted.label} antes do envio.`);
      }
    }
  }

  return Array.from(warnings);
}

export function createPatientHandoffDraft(
  input: CreatePatientHandoffInput
): PatientHandoff {
  assertNonEmpty(input.patientId, 'patientId');
  assertNonEmpty(input.sessionId, 'sessionId');
  assertNonEmpty(input.professionalName, 'professionalName');

  const summary = normalizeText(input.summary);
  const uniqueTasks = Array.from(
    new Map(
      input.tasks
        .map(normalizeText)
        .filter(Boolean)
        .map((task) => [task.toLocaleLowerCase('pt-BR'), task])
    ).values()
  );

  return {
    schemaVersion: 1,
    patientId: input.patientId,
    sessionId: input.sessionId,
    summary,
    tasks: uniqueTasks.map((title, index) => ({
      id: `${input.sessionId}-task-${index + 1}`,
      title,
      completed: false,
    })),
    nextSessionLabel: input.nextSessionLabel
      ? normalizeText(input.nextSessionLabel)
      : undefined,
    professionalName: normalizeText(input.professionalName),
    status: 'draft',
    humanReviewRequired: true,
    safetyWarnings: reviewPatientHandoffContent(summary, uniqueTasks),
  };
}

export function approvePatientHandoff(
  draft: PatientHandoff,
  approvedBy: string,
  approvedAt: string
): PatientHandoff {
  assertNonEmpty(approvedBy, 'approvedBy');
  if (Number.isNaN(Date.parse(approvedAt))) {
    throw new Error('approvedAt deve ser uma data ISO válida.');
  }
  if (draft.status !== 'draft') {
    throw new Error('Somente uma entrega em rascunho pode ser aprovada.');
  }
  if (draft.safetyWarnings.length > 0) {
    throw new Error('Revise os alertas de segurança antes de aprovar a entrega.');
  }

  return {
    ...draft,
    status: 'approved',
    approvedBy: approvedBy.trim(),
    approvedAt,
  };
}

export function markPatientHandoffDelivered(
  handoff: PatientHandoff,
  deliveredAt: string
): PatientHandoff {
  if (Number.isNaN(Date.parse(deliveredAt))) {
    throw new Error('deliveredAt deve ser uma data ISO válida.');
  }
  if (handoff.status !== 'approved') {
    throw new Error('Somente uma entrega aprovada pode ser disponibilizada.');
  }

  return {
    ...handoff,
    status: 'delivered',
    deliveredAt,
  };
}

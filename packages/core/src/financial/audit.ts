import type { FinancialAuditEvent } from './ports';
import { assertId, assertIsoDate } from './validation';

export interface CreateFinancialAuditEventInput
  extends Omit<FinancialAuditEvent, 'metadata'> {
  metadata?: Readonly<Record<string, string | number | boolean>>;
}

const FORBIDDEN_METADATA_KEYS = [
  'patientname',
  'patientemail',
  'patientphone',
  'cpf',
  'clinicalnote',
  'transcription',
];

export function createFinancialAuditEvent(
  input: CreateFinancialAuditEventInput
): FinancialAuditEvent {
  assertId(input.id, 'id');
  assertId(input.organizationId, 'organizationId');
  assertId(input.actorId, 'actorId');
  assertId(input.entityType, 'entityType');
  assertId(input.entityId, 'entityId');
  assertIsoDate(input.occurredAt, 'occurredAt');

  const metadataKeys = Object.keys(input.metadata ?? {});
  const forbiddenKey = metadataKeys.find((key) =>
    FORBIDDEN_METADATA_KEYS.includes(key.toLocaleLowerCase('en-US'))
  );
  if (forbiddenKey) {
    throw new Error(
      `Metadado sensível não permitido no log financeiro: ${forbiddenKey}.`
    );
  }

  return {
    ...input,
    metadata: input.metadata ? { ...input.metadata } : undefined,
  };
}

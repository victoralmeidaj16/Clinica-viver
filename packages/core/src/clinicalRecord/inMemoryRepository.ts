import type {
  ClinicalRecordAccessAuditEvent,
  ClinicalRecordAccessAuditPort,
  ClinicalRecordFilter,
  ClinicalRecordRepository,
  CommitClinicalRecordInput,
} from './ports';
import type { ClinicalRecord, ClinicalRecordEvent } from './types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryClinicalRecordRepository
  implements ClinicalRecordRepository
{
  private readonly records = new Map<string, ClinicalRecord>();
  private readonly commands = new Map<string, string>();
  private readonly outbox: ClinicalRecordEvent[] = [];

  constructor(seed: readonly ClinicalRecord[] = []) {
    seed.forEach((record) => {
      this.records.set(this.key(record.organizationId, record.id), clone(record));
    });
  }

  private key(organizationId: string, value: string): string {
    return `${organizationId}:${value}`;
  }

  async getById(
    organizationId: string,
    recordId: string
  ): Promise<ClinicalRecord | null> {
    const record = this.records.get(this.key(organizationId, recordId));
    return record ? clone(record) : null;
  }

  async findBySessionId(
    organizationId: string,
    sessionId: string
  ): Promise<ClinicalRecord | null> {
    const record = Array.from(this.records.values()).find(
      (item) =>
        item.organizationId === organizationId &&
        item.sessionId === sessionId
    );
    return record ? clone(record) : null;
  }

  async findByCommandId(
    organizationId: string,
    commandId: string
  ): Promise<ClinicalRecord | null> {
    const recordId = this.commands.get(this.key(organizationId, commandId));
    return recordId ? this.getById(organizationId, recordId) : null;
  }

  async list(filter: ClinicalRecordFilter): Promise<readonly ClinicalRecord[]> {
    return Array.from(this.records.values())
      .filter(
        (record) =>
          record.organizationId === filter.organizationId &&
          (!filter.patientId || record.patientId === filter.patientId) &&
          (!filter.professionalId ||
            record.assignedProfessionalIds.includes(filter.professionalId)) &&
          (!filter.statuses || filter.statuses.includes(record.status)) &&
          (!filter.createdFrom ||
            Date.parse(record.createdAt) >= Date.parse(filter.createdFrom)) &&
          (!filter.createdUntil ||
            Date.parse(record.createdAt) <= Date.parse(filter.createdUntil))
      )
      .map(clone);
  }

  async commit(input: CommitClinicalRecordInput): Promise<void> {
    const commandKey = this.key(input.record.organizationId, input.commandId);
    if (this.commands.has(commandKey)) return;

    const recordKey = this.key(input.record.organizationId, input.record.id);
    const current = this.records.get(recordKey);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== input.expectedVersion) {
      throw new Error(
        `Conflito de versão: esperado ${input.expectedVersion}, atual ${currentVersion}.`
      );
    }
    if (input.record.version !== input.expectedVersion + 1) {
      throw new Error('A nova versão do prontuário é inválida.');
    }
    const sameSession = Array.from(this.records.values()).find(
      (item) =>
        item.organizationId === input.record.organizationId &&
        item.sessionId === input.record.sessionId &&
        item.id !== input.record.id
    );
    if (sameSession) {
      throw new Error('A sessão já possui outro prontuário.');
    }
    this.records.set(recordKey, clone(input.record));
    this.commands.set(commandKey, input.record.id);
    this.outbox.push(...input.events.map(clone));
  }

  listOutboxEvents(): readonly ClinicalRecordEvent[] {
    return clone(this.outbox);
  }
}

export class InMemoryClinicalRecordAccessAudit
  implements ClinicalRecordAccessAuditPort
{
  private readonly events: ClinicalRecordAccessAuditEvent[] = [];

  async append(event: ClinicalRecordAccessAuditEvent): Promise<void> {
    this.events.push(clone(event));
  }

  listEvents(): readonly ClinicalRecordAccessAuditEvent[] {
    return clone(this.events);
  }
}

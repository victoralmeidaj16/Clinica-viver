import type {
  ClinicalSessionFilter,
  ClinicalSessionRepository,
  CommitClinicalSessionInput,
} from './ports';
import type { ClinicalSession, ClinicalSessionEvent } from './types';

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class InMemoryClinicalSessionRepository
  implements ClinicalSessionRepository
{
  private readonly sessions = new Map<string, ClinicalSession>();
  private readonly commands = new Map<string, string>();
  private readonly outbox: ClinicalSessionEvent[] = [];

  constructor(seed: readonly ClinicalSession[] = []) {
    seed.forEach((session) => {
      this.sessions.set(this.key(session.organizationId, session.id), clone(session));
    });
  }

  private key(organizationId: string, value: string): string {
    return `${organizationId}:${value}`;
  }

  async getById(
    organizationId: string,
    sessionId: string
  ): Promise<ClinicalSession | null> {
    const session = this.sessions.get(this.key(organizationId, sessionId));
    return session ? clone(session) : null;
  }

  async list(filter: ClinicalSessionFilter): Promise<readonly ClinicalSession[]> {
    return Array.from(this.sessions.values())
      .filter(
        (session) =>
          session.organizationId === filter.organizationId &&
          (!filter.patientId || session.patientId === filter.patientId) &&
          (!filter.professionalId ||
            session.assignedProfessionalIds.includes(filter.professionalId)) &&
          (!filter.statuses || filter.statuses.includes(session.status)) &&
          (!filter.scheduledFrom ||
            Date.parse(session.scheduledStart) >=
              Date.parse(filter.scheduledFrom)) &&
          (!filter.scheduledUntil ||
            Date.parse(session.scheduledStart) <=
              Date.parse(filter.scheduledUntil))
      )
      .map(clone);
  }

  async findByCommandId(
    organizationId: string,
    commandId: string
  ): Promise<ClinicalSession | null> {
    const sessionId = this.commands.get(this.key(organizationId, commandId));
    return sessionId ? this.getById(organizationId, sessionId) : null;
  }

  async commit(input: CommitClinicalSessionInput): Promise<void> {
    const commandKey = this.key(
      input.session.organizationId,
      input.commandId
    );
    if (this.commands.has(commandKey)) return;

    const sessionKey = this.key(
      input.session.organizationId,
      input.session.id
    );
    const current = this.sessions.get(sessionKey);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== input.expectedVersion) {
      throw new Error(
        `Conflito de versão: esperado ${input.expectedVersion}, atual ${currentVersion}.`
      );
    }
    if (input.session.version !== input.expectedVersion + 1) {
      throw new Error('A nova versão da sessão é inválida.');
    }
    this.sessions.set(sessionKey, clone(input.session));
    this.commands.set(commandKey, input.session.id);
    this.outbox.push(...input.events.map(clone));
  }

  listOutboxEvents(): readonly ClinicalSessionEvent[] {
    return clone(this.outbox);
  }
}

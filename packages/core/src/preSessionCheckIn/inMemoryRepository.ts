import type {
  CommitPreSessionCheckInInput,
  PreSessionCheckInFilter,
  PreSessionCheckInRepository,
} from './ports';
import type { PreSessionCheckIn, PreSessionCheckInEvent } from './types';

const key = (organizationId: string, value: string) =>
  `${organizationId}:${value}`;
const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryPreSessionCheckInRepository
  implements PreSessionCheckInRepository
{
  private readonly checkIns = new Map<string, PreSessionCheckIn>();
  private readonly commands = new Map<string, string>();
  private readonly outbox: PreSessionCheckInEvent[] = [];

  constructor(seed: readonly PreSessionCheckIn[] = []) {
    seed.forEach((checkIn) =>
      this.checkIns.set(key(checkIn.organizationId, checkIn.id), clone(checkIn))
    );
  }

  async getById(
    organizationId: string,
    checkInId: string
  ): Promise<PreSessionCheckIn | null> {
    const checkIn = this.checkIns.get(key(organizationId, checkInId));
    return checkIn ? clone(checkIn) : null;
  }

  async list(
    filter: PreSessionCheckInFilter
  ): Promise<readonly PreSessionCheckIn[]> {
    return Array.from(this.checkIns.values())
      .filter(
        (checkIn) =>
          checkIn.organizationId === filter.organizationId &&
          (!filter.patientId || checkIn.patientId === filter.patientId) &&
          (!filter.professionalId ||
            checkIn.professionalId === filter.professionalId) &&
          (!filter.appointmentId ||
            checkIn.appointmentId === filter.appointmentId) &&
          (!filter.statuses || filter.statuses.includes(checkIn.status))
      )
      .map(clone);
  }

  async findByCommandId(
    organizationId: string,
    commandId: string
  ): Promise<PreSessionCheckIn | null> {
    const checkInId = this.commands.get(key(organizationId, commandId));
    return checkInId ? this.getById(organizationId, checkInId) : null;
  }

  async commit(input: CommitPreSessionCheckInInput): Promise<void> {
    const commandKey = key(input.checkIn.organizationId, input.commandId);
    if (this.commands.has(commandKey)) return;

    const checkInKey = key(input.checkIn.organizationId, input.checkIn.id);
    const current = this.checkIns.get(checkInKey);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== input.expectedVersion) {
      throw new Error(
        `Conflito de versão: esperado ${input.expectedVersion}, atual ${currentVersion}.`
      );
    }
    if (input.checkIn.version !== input.expectedVersion + 1) {
      throw new Error('A nova versão do check-in pré-sessão é inválida.');
    }

    this.checkIns.set(checkInKey, clone(input.checkIn));
    this.commands.set(commandKey, input.checkIn.id);
    this.outbox.push(...input.events.map(clone));
  }

  listOutboxEvents(): readonly PreSessionCheckInEvent[] {
    return clone(this.outbox);
  }
}

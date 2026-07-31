import type {
  ClinicalTimelineAccessAuditPort,
  ClinicalTimelineRepository,
} from './ports';
import type {
  ClinicalTimelineEntry,
  ClinicalTimelineFilter,
} from './types';

const key = (organizationId: string, entryId: string) =>
  `${organizationId}:${entryId}`;
const clone = <T>(value: T): T => structuredClone(value);

export class InMemoryClinicalTimelineRepository
  implements ClinicalTimelineRepository
{
  private readonly entries = new Map<string, ClinicalTimelineEntry>();

  constructor(seed: readonly ClinicalTimelineEntry[] = []) {
    seed.forEach((entry) =>
      this.entries.set(key(entry.organizationId, entry.id), clone(entry))
    );
  }

  async upsert(entries: readonly ClinicalTimelineEntry[]): Promise<void> {
    entries.forEach((entry) =>
      this.entries.set(key(entry.organizationId, entry.id), clone(entry))
    );
  }

  async list(
    filter: ClinicalTimelineFilter
  ): Promise<readonly ClinicalTimelineEntry[]> {
    return Array.from(this.entries.values())
      .filter(
        (entry) =>
          entry.organizationId === filter.organizationId &&
          entry.patientId === filter.patientId &&
          (!filter.categories || filter.categories.includes(entry.category)) &&
          (!filter.occurredFrom ||
            Date.parse(entry.occurredAt) >= Date.parse(filter.occurredFrom)) &&
          (!filter.occurredUntil ||
            Date.parse(entry.occurredAt) <= Date.parse(filter.occurredUntil))
      )
      .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))
      .map(clone);
  }
}

export class InMemoryClinicalTimelineAccessAudit
  implements ClinicalTimelineAccessAuditPort
{
  private readonly events: Array<Parameters<ClinicalTimelineAccessAuditPort['append']>[0]> = [];

  async append(
    input: Parameters<ClinicalTimelineAccessAuditPort['append']>[0]
  ): Promise<void> {
    this.events.push(clone(input));
  }

  listEvents(): readonly Parameters<ClinicalTimelineAccessAuditPort['append']>[0][] {
    return clone(this.events);
  }
}

import type { ExternalCalendarConnectionRepository } from './ports';
import type { ExternalCalendarConnection, ExternalCalendarEventLink } from './types';

function clone<T>(value: T): T { return structuredClone(value); }
const key = (organizationId: string, value: string) => `${organizationId}:${value}`;

export class InMemoryExternalCalendarConnectionRepository implements ExternalCalendarConnectionRepository {
  private readonly connections = new Map<string, ExternalCalendarConnection>();
  private readonly eventLinks = new Map<string, ExternalCalendarEventLink>();

  async getByProfessional(organizationId: string, professionalId: string): Promise<ExternalCalendarConnection | null> {
    const connection = this.connections.get(key(organizationId, professionalId));
    return connection ? clone(connection) : null;
  }

  async save(connection: ExternalCalendarConnection): Promise<void> {
    this.connections.set(key(connection.organizationId, connection.professionalId), clone(connection));
  }

  async getEventLink(organizationId: string, appointmentId: string): Promise<ExternalCalendarEventLink | null> {
    const link = Array.from(this.eventLinks.values()).find((item) => {
      const connection = Array.from(this.connections.values()).find(
        (candidate) =>
          candidate.id === item.connectionId &&
          candidate.organizationId === organizationId
      );
      return item.appointmentId === appointmentId && Boolean(connection);
    });
    return link ? clone(link) : null;
  }

  async saveEventLink(link: ExternalCalendarEventLink): Promise<void> {
    this.eventLinks.set(key(link.connectionId, link.appointmentId), clone(link));
  }
}

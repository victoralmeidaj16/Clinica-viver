import type { AppointmentFilter, AppointmentRepository, CommitAppointmentInput } from './ports';
import type { Appointment, AppointmentEvent } from './types';

function clone<T>(value: T): T { return structuredClone(value); }
const key = (organizationId: string, value: string) => `${organizationId}:${value}`;

export class InMemoryAppointmentRepository implements AppointmentRepository {
  private readonly appointments = new Map<string, Appointment>();
  private readonly commands = new Map<string, string>();
  private readonly outbox: AppointmentEvent[] = [];

  constructor(seed: readonly Appointment[] = []) {
    seed.forEach((appointment) => this.appointments.set(key(appointment.organizationId, appointment.id), clone(appointment)));
  }

  async getById(organizationId: string, appointmentId: string): Promise<Appointment | null> {
    const appointment = this.appointments.get(key(organizationId, appointmentId));
    return appointment ? clone(appointment) : null;
  }

  async list(filter: AppointmentFilter): Promise<readonly Appointment[]> {
    return Array.from(this.appointments.values()).filter((appointment) =>
      appointment.organizationId === filter.organizationId &&
      (!filter.patientId || appointment.patientId === filter.patientId) &&
      (!filter.professionalId || appointment.professionalId === filter.professionalId) &&
      (!filter.statuses || filter.statuses.includes(appointment.status)) &&
      (!filter.startsFrom || Date.parse(appointment.startsAt) >= Date.parse(filter.startsFrom)) &&
      (!filter.startsUntil || Date.parse(appointment.startsAt) <= Date.parse(filter.startsUntil))
    ).map(clone);
  }

  async findByCommandId(organizationId: string, commandId: string): Promise<Appointment | null> {
    const appointmentId = this.commands.get(key(organizationId, commandId));
    return appointmentId ? this.getById(organizationId, appointmentId) : null;
  }

  async commit(input: CommitAppointmentInput): Promise<void> {
    const commandKey = key(input.appointment.organizationId, input.commandId);
    if (this.commands.has(commandKey)) return;
    const appointmentKey = key(input.appointment.organizationId, input.appointment.id);
    const current = this.appointments.get(appointmentKey);
    const currentVersion = current?.version ?? 0;
    if (currentVersion !== input.expectedVersion) throw new Error(`Conflito de versão: esperado ${input.expectedVersion}, atual ${currentVersion}.`);
    if (input.appointment.version !== input.expectedVersion + 1) throw new Error('A nova versão do agendamento é inválida.');
    this.appointments.set(appointmentKey, clone(input.appointment));
    this.commands.set(commandKey, input.appointment.id);
    this.outbox.push(...input.events.map(clone));
  }

  listOutboxEvents(): readonly AppointmentEvent[] { return clone(this.outbox); }
}

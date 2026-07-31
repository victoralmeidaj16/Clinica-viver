import type { ClinicalSessionEvent } from '../../clinicalSession';
import type { AppointmentEvent } from '../../scheduling';
import { createClinicalTimelineEntry, timelineEntryId } from '../entryFactory';
import type { ClinicalTimelineEntry } from '../types';

const SESSION_EVENT_LABELS: Readonly<Record<string, string>> = {
  'clinical_session.started': 'Sessão iniciada',
  'clinical_session.completed': 'Sessão concluída',
  'clinical_session.cancelled': 'Sessão cancelada',
  'clinical_session.no_show': 'Falta registrada',
  'clinical_session.record_approved': 'Prontuário da sessão aprovado',
};

export function projectClinicalSessionEvent(
  event: ClinicalSessionEvent,
  professionalIds: readonly string[]
): ClinicalTimelineEntry | null {
  const title = SESSION_EVENT_LABELS[event.type];
  if (!title) return null;
  const attention = ['clinical_session.cancelled', 'clinical_session.no_show'].includes(event.type);
  return createClinicalTimelineEntry({
    id: timelineEntryId('clinical_session_event', event.id, event.type),
    organizationId: event.organizationId,
    patientId: event.patientId,
    authorizedProfessionalIds: professionalIds,
    category: 'session',
    importance: attention ? 'attention' : 'routine',
    occurredAt: event.occurredAt,
    recordedAt: event.occurredAt,
    title,
    summary: 'Evento registrado no ciclo da sessão clínica.',
    tags: ['sessão', event.type],
    evidence: {
      sourceType: 'clinical_session_event',
      sourceId: event.id,
      sourceField: 'type',
    },
  });
}

const APPOINTMENT_EVENT_LABELS: Readonly<Record<string, string>> = {
  'appointment.rescheduled': 'Consulta remarcada',
  'appointment.cancelled': 'Consulta cancelada',
  'appointment.no_show': 'Falta no agendamento',
  'appointment.completed': 'Atendimento realizado',
};

export function projectAppointmentEvent(
  event: AppointmentEvent
): ClinicalTimelineEntry | null {
  const title = APPOINTMENT_EVENT_LABELS[event.type];
  if (!title) return null;
  const attention = ['appointment.cancelled', 'appointment.no_show'].includes(event.type);
  return createClinicalTimelineEntry({
    id: timelineEntryId('appointment_event', event.id, event.type),
    organizationId: event.organizationId,
    patientId: event.patientId,
    authorizedProfessionalIds: [event.professionalId],
    category: 'appointment',
    importance: attention ? 'attention' : 'routine',
    occurredAt: event.occurredAt,
    recordedAt: event.occurredAt,
    title,
    summary: 'Evento operacional vinculado ao agendamento.',
    tags: ['agenda', event.type],
    evidence: {
      sourceType: 'appointment_event',
      sourceId: event.id,
      sourceField: 'type',
    },
  });
}

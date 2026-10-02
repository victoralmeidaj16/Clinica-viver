import type { Appointment, PatientProfile } from '@thats-life/core';

export function documentDemoSeed(): { patients: PatientProfile[]; appointments: Appointment[] } {
  const createdAt = '2026-01-01T12:00:00.000Z';
  const patient: PatientProfile = {
    id: 'patient-document-demo', organizationId: 'org-demo', displayName: 'Ana Exemplo (paciente fictícia)',
    status: 'active', primaryProfessionalId: 'professional-1', assignedProfessionalIds: ['professional-1'], createdAt, updatedAt: createdAt,
  };
  const appointments: Appointment[] = [8, 1].map((daysAgo, index) => {
    const start = new Date();
    start.setUTCDate(start.getUTCDate() - daysAgo);
    start.setUTCHours(15, 0, 0, 0);
    return {
      schemaVersion: 1, id: `appointment-document-demo-${index + 1}`, organizationId: patient.organizationId,
      patientId: patient.id, professionalId: 'professional-1', startsAt: start.toISOString(),
      endsAt: new Date(start.getTime() + 50 * 60_000).toISOString(), timezone: 'America/Sao_Paulo',
      mode: 'in_person', status: 'completed', reminders: [], version: 1, createdAt, updatedAt: createdAt,
    };
  });
  return { patients: [patient], appointments };
}

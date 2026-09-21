import {
  assertStaffAuthorized,
  createClinicalTimelineEntry,
  listClinicalTimelineForStaff,
  searchClinicalTimelineForStaff,
  timelineEntryId,
  type ClinicalTimelineCategory,
  type ClinicalTimelineEntry,
} from '@thats-life/core';
import { ApplicationError } from './http';
import type { RequestContext } from './context';
import { getApplicationStore, persistApplicationState } from './store';
import {
  MANUAL_SOAP_FIELDS,
  type ManualClinicalRecordInput,
} from './manualClinicalRecordInput';

export interface TimelineQueryInput {
  patientId: string;
  query?: string;
  categories?: readonly ClinicalTimelineCategory[];
  occurredFrom?: string;
  occurredUntil?: string;
}

/**
 * Persiste um registro manual como projeções SOAP da linha do tempo.
 * Os identificadores vêm da chave de idempotência para que uma repetição da
 * mesma requisição atualize as mesmas linhas, sem duplicar prontuários.
 */
export async function createManualClinicalRecord(
  context: RequestContext,
  input: ManualClinicalRecordInput
): Promise<{ entries: readonly ClinicalTimelineEntry[] }> {
  const store = getApplicationStore();
  const professionalId = context.actor.professionalProfileId;
  if (!context.actor.roles.includes('professional') || !professionalId) {
    throw new ApplicationError('FORBIDDEN', 'Somente um psicólogo pode registrar prontuários.', 403);
  }

  const patient = await store.identities.getPatient(context.actor.organizationId, input.patientId);
  if (!patient) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  assertStaffAuthorized(context.actor, 'clinical_records.write', {
    organizationId: patient.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });

  const recordedAt = new Date().toISOString();
  const sourceId = `manual-${context.idempotencyKey}`;
  const entries = MANUAL_SOAP_FIELDS.flatMap(([field, label]) => {
    const content = input[field];
    if (!content) return [];
    return [createClinicalTimelineEntry({
      id: timelineEntryId('clinical_record_revision', sourceId, field),
      organizationId: context.actor.organizationId,
      patientId: patient.id,
      authorizedProfessionalIds: patient.assignedProfessionalIds,
      category: 'clinical_record',
      importance: 'routine',
      occurredAt: recordedAt,
      recordedAt,
      title: `${input.title} — ${label}`,
      summary: `Evolução clínica manual — ${label}.`,
      evidenceExcerpt: content,
      tags: ['prontuario-manual', 'soap', label],
      evidence: {
        sourceType: 'clinical_record_revision',
        sourceId,
        sourceVersion: 1,
        sourceRevisionId: `${sourceId}-rev-1`,
        sourceField: `content.${field}`,
      },
    })];
  });

  await store.timeline.upsert(entries);
  await persistApplicationState();
  return { entries };
}

export async function getClinicalTimeline(
  context: RequestContext,
  input: TimelineQueryInput
) {
  const store = getApplicationStore();
  const metadata = {
    occurredAt: new Date().toISOString(),
    correlationId: context.correlationId,
  };

  const dependencies = {
    timelines: store.timeline,
    identities: store.identities,
    audit: store.timelineAudit,
  };

  if (input.query && input.query.trim().length > 0) {
    const searchResult = await searchClinicalTimelineForStaff(
      dependencies,
      context.actor,
      {
        patientId: input.patientId,
        query: input.query,
        categories: input.categories,
      },
      metadata
    );

    return {
      mode: searchResult.mode,
      query: searchResult.query,
      normalizedTerms: searchResult.normalizedTerms,
      firstEvidenceAt: searchResult.firstEvidenceAt,
      entries: searchResult.matches.map((m) => ({
        ...m.entry,
        score: m.score,
        matchedTerms: m.matchedTerms,
      })),
    };
  }

  const entries = await listClinicalTimelineForStaff(
    dependencies,
    context.actor,
    {
      patientId: input.patientId,
      categories: input.categories,
      occurredFrom: input.occurredFrom,
      occurredUntil: input.occurredUntil,
    },
    metadata
  );

  return {
    mode: 'chronological',
    query: undefined,
    normalizedTerms: [],
    entries: entries.map((e) => ({ ...e, score: undefined, matchedTerms: [] })),
  };
}

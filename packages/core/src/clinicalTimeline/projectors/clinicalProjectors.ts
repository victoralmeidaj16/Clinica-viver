import type { CompletedAssessment } from '../../assessmentWorkflow';
import type { ClinicalRecord } from '../../clinicalRecord';
import { createClinicalTimelineEntry, timelineEntryId } from '../entryFactory';
import type { ClinicalTimelineEntry } from '../types';

const SOAP_FIELDS = [
  ['subjective', 'Subjetivo'],
  ['objective', 'Objetivo'],
  ['assessment', 'Avaliação'],
  ['plan', 'Plano'],
] as const;

export function projectApprovedClinicalRecord(
  record: ClinicalRecord
): readonly ClinicalTimelineEntry[] {
  if (record.status !== 'approved' || !record.currentApprovedRevisionNumber) {
    return [];
  }
  const revision = record.revisions.find(
    (item) => item.revisionNumber === record.currentApprovedRevisionNumber
  );
  const approval = record.approvals.find(
    (item) => item.revisionNumber === record.currentApprovedRevisionNumber
  );
  if (!revision || !approval) {
    throw new Error('O prontuário aprovado não possui revisão e aprovação correspondentes.');
  }

  return SOAP_FIELDS.map(([field, label]) =>
    createClinicalTimelineEntry({
      id: timelineEntryId(
        'clinical_record_revision',
        record.id,
        `${revision.id}:${field}`
      ),
      organizationId: record.organizationId,
      patientId: record.patientId,
      authorizedProfessionalIds: record.assignedProfessionalIds,
      category: 'clinical_record',
      importance: 'milestone',
      occurredAt: approval.approvedAt,
      recordedAt: approval.approvedAt,
      title: `Evolução SOAP aprovada — ${label}`,
      summary: `Revisão ${revision.revisionNumber} aprovada pelo profissional responsável.`,
      evidenceExcerpt: revision.content[field],
      tags: ['soap', label, revision.kind],
      evidence: {
        sourceType: 'clinical_record_revision',
        sourceId: record.id,
        sourceVersion: record.version,
        sourceRevisionId: revision.id,
        sourceField: `content.${field}`,
        contentHashSha256: approval.contentHashSha256,
      },
    })
  );
}

export function projectCompletedAssessment(
  response: CompletedAssessment,
  context: {
    organizationId: string;
    professionalIds: readonly string[];
  }
): ClinicalTimelineEntry {
  return createClinicalTimelineEntry({
    id: timelineEntryId('assessment_response', response.id, 'score'),
    organizationId: context.organizationId,
    patientId: response.patientId,
    authorizedProfessionalIds: context.professionalIds,
    category: 'assessment',
    importance: response.hasRiskAlert ? 'attention' : 'routine',
    occurredAt: response.completedAt,
    recordedAt: response.completedAt,
    title: `${response.instrumentCode} concluído`,
    summary: `${response.totalScore} pontos • Gravidade ${response.severityLabel.toLocaleLowerCase('pt-BR')}.`,
    evidenceExcerpt: response.riskAlertReason,
    tags: [
      response.instrumentCode,
      response.severityLabel,
      response.hasRiskAlert ? 'risco' : 'rastreio',
    ],
    evidence: {
      sourceType: 'assessment_response',
      sourceId: response.id,
      sourceVersion: response.schemaVersion,
      sourceField: 'score',
    },
  });
}

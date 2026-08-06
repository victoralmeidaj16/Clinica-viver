import {
  createClinicalTimelineEntry,
  type ClinicalTimelineCategory,
  type ClinicalTimelineEntry,
  type ClinicalTimelineImportance,
  type TimelineEvidenceReference,
} from '@thats-life/core';

const organizationId = 'demo-org-01';
const patientId = 'pac_01';
const authorizedProfessionalIds = ['psi-demo-01'];

function entry(input: {
  id: string;
  category: ClinicalTimelineCategory;
  importance?: ClinicalTimelineImportance;
  occurredAt: string;
  title: string;
  summary: string;
  excerpt?: string;
  tags: readonly string[];
  evidence: TimelineEvidenceReference;
}): ClinicalTimelineEntry {
  return createClinicalTimelineEntry({
    organizationId,
    patientId,
    authorizedProfessionalIds,
    recordedAt: input.occurredAt,
    importance: input.importance ?? 'routine',
    evidenceExcerpt: input.excerpt,
    ...input,
  });
}

export const DEMO_CLINICAL_TIMELINE: readonly ClinicalTimelineEntry[] = [];

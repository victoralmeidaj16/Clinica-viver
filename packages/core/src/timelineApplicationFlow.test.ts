import { describe, expect, it } from 'vitest';
import {
  createClinicalTimelineEntry,
  createOrganization,
  createPatientProfile,
  createProfessionalProfile,
  listClinicalTimelineForStaff,
  searchClinicalTimelineForStaff,
  InMemoryClinicalTimelineAccessAudit,
  InMemoryClinicalTimelineRepository,
  InMemoryIdentityRepository,
} from './index';

describe('Linha do Tempo Clínica Longitudinal & Busca por Evidências', () => {
  const organizationId = 'org-demo';
  const patientId = 'patient-1';
  const professionalId = 'professional-1';
  const createdAt = '2026-07-31T12:00:00.000Z';
  const metadata = {
    occurredAt: createdAt,
    correlationId: 'test-timeline-corr',
  };

  const organization = createOrganization({
    id: organizationId,
    type: 'clinic',
    displayName: 'Clínica Demo',
    timezone: 'America/Sao_Paulo',
    createdAt,
  });

  const professional = createProfessionalProfile({
    id: professionalId,
    organizationId,
    userId: 'user-demo',
    displayName: 'Dra. Camila',
    councilType: 'CRP',
    councilRegistration: '06/12345',
    specialties: ['TCC'],
    createdAt,
  });

  const patient = createPatientProfile({
    id: patientId,
    organizationId,
    displayName: 'Mariana Costa',
    primaryProfessionalId: professionalId,
    assignedProfessionalIds: [professionalId],
    createdAt,
  });

  const staffActor = {
    actorType: 'staff' as const,
    organizationId,
    userId: professional.userId,
    membershipId: 'mem-1',
    membershipStatus: 'active' as const,
    roles: ['professional' as const],
    professionalProfileId: professionalId,
  };

  const entry1 = createClinicalTimelineEntry({
    id: 'timeline-entry-1',
    organizationId,
    patientId,
    authorizedProfessionalIds: [professionalId],
    category: 'clinical_record',
    importance: 'milestone',
    occurredAt: '2026-07-30T13:00:00.000Z',
    recordedAt: createdAt,
    title: 'Prontuário Aprovado — Sessão de Anamnese & Ansiedade',
    summary: 'Evolução clínica SOAP aprovada. Trabalhadas estratégias de regulação emocional e manejo de ansiedade ocupacional.',
    evidenceExcerpt: 'Paciente relata oscilações de ansiedade ligadas à rotina de trabalho e reuniões. Aplicadas técnicas de respiração diafragmática.',
    tags: ['ansiedade', 'trabalho', 'soap'],
    evidence: {
      sourceType: 'clinical_record_revision',
      sourceId: 'record-1',
      sourceVersion: 1,
      sourceRevisionId: 'rev-1',
      sourceField: 'content.assessment',
      contentHashSha256: 'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123',
    },
  });

  const entry2 = createClinicalTimelineEntry({
    id: 'timeline-entry-2',
    organizationId,
    patientId,
    authorizedProfessionalIds: [professionalId],
    category: 'assessment',
    importance: 'routine',
    occurredAt: '2026-07-30T12:00:00.000Z',
    recordedAt: createdAt,
    title: 'Escala GAD-7 — Ansiedade Leve',
    summary: 'Resultado da avaliação pré-sessão. Escore total 8 de 21 pontos (Ansiedade leve).',
    evidenceExcerpt: 'Escore total: 8 pontos. Sintomas levemente alterados nos últimos 14 dias.',
    tags: ['gad-7', 'escala'],
    evidence: {
      sourceType: 'assessment_response',
      sourceId: 'resp-1',
      sourceField: 'totalScore',
    },
  });

  it('lista a linha do tempo longitudinal do paciente com autorização de RBAC', async () => {
    const timelines = new InMemoryClinicalTimelineRepository([entry1, entry2]);
    const identities = new InMemoryIdentityRepository({
      organizations: [organization],
      professionals: [professional],
      patients: [patient],
    });
    const audit = new InMemoryClinicalTimelineAccessAudit();

    const entries = await listClinicalTimelineForStaff(
      { timelines, identities, audit },
      staffActor,
      { patientId },
      metadata
    );

    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('timeline-entry-1');
    expect(audit.listEvents()).toHaveLength(1);
    expect(audit.listEvents()[0].action).toBe('clinical_timeline.listed');
  });

  it('executa a busca determinística no modo evidence_only citando trecho e hash SHA-256', async () => {
    const timelines = new InMemoryClinicalTimelineRepository([entry1, entry2]);
    const identities = new InMemoryIdentityRepository({
      organizations: [organization],
      professionals: [professional],
      patients: [patient],
    });
    const audit = new InMemoryClinicalTimelineAccessAudit();

    const searchResult = await searchClinicalTimelineForStaff(
      { timelines, identities, audit },
      staffActor,
      { patientId, query: 'ansiedade no trabalho' },
      metadata
    );

    expect(searchResult.mode).toBe('evidence_only');
    expect(searchResult.matches.length).toBeGreaterThan(0);
    const topMatch = searchResult.matches[0].entry;
    expect(topMatch.evidence.contentHashSha256).toBe(
      'a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef0123'
    );
    expect(topMatch.evidenceExcerpt).toContain('ansiedade ligadas à rotina de trabalho');
    expect(audit.listEvents()[0].action).toBe('clinical_timeline.searched');
  });
});

import { describe, expect, it } from 'vitest';
import {
  InMemoryClinicalSessionRepository,
  endClinicalSession,
  scheduleClinicalSession,
  startClinicalSession,
  type ClinicalSession,
} from '../clinicalSession';
import type { StaffAccessContext } from '../identity';
import {
  approveClinicalRecordRevision,
  approveClinicalRecordRevisionCommand,
  createClinicalRecordAmendment,
  createClinicalRecordDraft,
  createClinicalRecordDraftCommand,
  InMemoryClinicalRecordAccessAudit,
  InMemoryClinicalRecordRepository,
  getClinicalRecordForStaff,
  listClinicalRecordsForStaff,
  setClinicalRecordLegalHold,
  type ClinicalRecord,
  type ClinicalRecordCommandMetadata,
  type SoapClinicalContent,
} from './index';

const organizationId = 'org-1';
const patientId = 'patient-1';
const professionalId = 'professional-1';
const hash = 'a'.repeat(64);

const content: SoapClinicalContent = {
  subjective: 'Paciente relata maior organização da rotina.',
  objective: 'Tom de voz estável conforme a fonte de áudio.',
  assessment: 'Evolução compatível com o plano em revisão profissional.',
  plan: 'Manter registro diário e revisar na próxima sessão.',
  extractedTasks: ['Registrar a rotina diariamente'],
};

function metadata(
  occurredAt: string,
  correlationId = `correlation-${occurredAt}`
): ClinicalRecordCommandMetadata {
  return { actorUserId: 'user-professional', occurredAt, correlationId };
}

function draftRecord(source: 'manual' | 'ai_assisted' = 'ai_assisted') {
  return createClinicalRecordDraft(
    {
      id: 'record-1',
      revisionId: 'revision-1',
      organizationId,
      patientId,
      sessionId: 'session-1',
      responsibleProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId],
      source,
      content,
      aiProvenance:
        source === 'ai_assisted'
          ? {
              provider: 'provider-test',
              model: 'model-test',
              promptVersion: 'soap-v1',
              transcriptionId: 'transcription-1',
              generatedAt: '2026-08-01T12:59:00.000Z',
            }
          : undefined,
      retentionUntil: '2031-08-01T13:00:00.000Z',
      createdAt: '2026-08-01T13:00:00.000Z',
    },
    metadata('2026-08-01T13:00:00.000Z')
  );
}

function approvedRecord(): ClinicalRecord {
  return approveClinicalRecordRevision(
    draftRecord().record,
    {
      approvalId: 'approval-1',
      professionalId,
      contentHashSha256: hash,
    },
    metadata('2026-08-01T13:01:00.000Z')
  ).record;
}

function endedSession(): ClinicalSession {
  let session = scheduleClinicalSession(
    {
      id: 'session-1',
      organizationId,
      patientId,
      primaryProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId],
      mode: 'video',
      scheduledStart: '2026-08-01T12:00:00.000Z',
      scheduledEnd: '2026-08-01T13:00:00.000Z',
      automationPlan: {
        transcription: false,
        patientHandoff: false,
        billing: false,
        receipt: false,
        notification: false,
      },
      createdAt: '2026-08-01T10:00:00.000Z',
    },
    metadata('2026-08-01T10:00:00.000Z')
  ).session;
  session = startClinicalSession(
    session,
    metadata('2026-08-01T12:00:00.000Z')
  ).session;
  return endClinicalSession(
    session,
    metadata('2026-08-01T13:00:00.000Z')
  ).session;
}

const professionalActor: StaffAccessContext = {
  actorType: 'staff',
  organizationId,
  userId: 'user-professional',
  membershipId: 'membership-1',
  membershipStatus: 'active',
  roles: ['professional'],
  professionalProfileId: professionalId,
};

describe('clinical record aggregate', () => {
  it('mantém rascunho de IA separado da aprovação humana', () => {
    const result = draftRecord();

    expect(result.record.status).toBe('draft');
    expect(result.record.approvals).toHaveLength(0);
    expect(result.record.revisions[0].aiProvenance).toMatchObject({
      promptVersion: 'soap-v1',
      transcriptionId: 'transcription-1',
    });
    expect(JSON.stringify(result.events)).not.toContain(
      content.subjective
    );
    expect(() =>
      createClinicalRecordDraft(
        {
          id: 'record-2',
          revisionId: 'revision-2',
          organizationId,
          patientId,
          sessionId: 'session-2',
          responsibleProfessionalId: professionalId,
          assignedProfessionalIds: [professionalId],
          source: 'ai_assisted',
          content,
          retentionUntil: '2031-08-01T13:00:00.000Z',
          createdAt: '2026-08-01T13:00:00.000Z',
        },
        metadata('2026-08-01T13:00:00.000Z')
      )
    ).toThrow('exigem proveniência');
  });

  it('aprova uma versão específica com assinatura e hash de conteúdo', () => {
    const result = approveClinicalRecordRevision(
      draftRecord().record,
      {
        approvalId: 'approval-1',
        professionalId,
        contentHashSha256: hash.toUpperCase(),
      },
      metadata('2026-08-01T13:01:00.000Z')
    );

    expect(result.record.status).toBe('approved');
    expect(result.record.currentApprovedRevisionNumber).toBe(1);
    expect(result.record.approvals[0]).toMatchObject({
      revisionNumber: 1,
      contentHashSha256: hash,
      attestation: 'reviewed_and_approved_by_professional',
    });
    expect(() =>
      approveClinicalRecordRevision(
        draftRecord().record,
        {
          approvalId: 'invalid',
          professionalId,
          contentHashSha256: 'hash-invalido',
        },
        metadata('2026-08-01T13:01:00.000Z')
      )
    ).toThrow('64 caracteres hexadecimais');
  });

  it('retifica por nova versão sem apagar o conteúdo aprovado anterior', () => {
    const first = approvedRecord();
    const originalContent = structuredClone(first.revisions[0].content);
    const amendment = createClinicalRecordAmendment(
      first,
      {
        revisionId: 'revision-2',
        reason: 'Correção de informação registrada após revisão profissional',
        content: { ...content, plan: 'Plano corrigido e documentado.' },
        createdAt: '2026-08-01T13:02:00.000Z',
      },
      metadata('2026-08-01T13:02:00.000Z')
    ).record;
    const approvedAmendment = approveClinicalRecordRevision(
      amendment,
      {
        approvalId: 'approval-2',
        professionalId,
        contentHashSha256: 'b'.repeat(64),
      },
      metadata('2026-08-01T13:03:00.000Z')
    ).record;

    expect(approvedAmendment.revisions).toHaveLength(2);
    expect(approvedAmendment.revisions[0].content).toEqual(originalContent);
    expect(approvedAmendment.currentApprovedRevisionNumber).toBe(2);
    expect(approvedAmendment.approvals.map((item) => item.revisionNumber))
      .toEqual([1, 2]);
  });

  it('aplica retenção legal sem expor conteúdo no evento', () => {
    const result = setClinicalRecordLegalHold(
      approvedRecord(),
      true,
      'LEGAL_REQUEST',
      metadata('2026-08-01T13:02:00.000Z')
    );
    expect(result.record.legalHold).toBe(true);
    expect(result.events[0].metadata).toEqual({
      enabled: true,
      reasonCode: 'LEGAL_REQUEST',
    });
  });
});

describe('clinical record commands and persistence', () => {
  it('autoriza o profissional atribuído e trata comandos como idempotentes', async () => {
    const records = new InMemoryClinicalRecordRepository();
    const sessions = new InMemoryClinicalSessionRepository([endedSession()]);
    const dependencies = { records, sessions };
    const input = {
      id: 'record-1',
      revisionId: 'revision-1',
      organizationId,
      patientId,
      sessionId: 'session-1',
      responsibleProfessionalId: professionalId,
      assignedProfessionalIds: [professionalId],
      source: 'manual' as const,
      content,
      retentionUntil: '2031-08-01T13:01:00.000Z',
      createdAt: '2026-08-01T13:01:00.000Z',
    };
    const commandMetadata = {
      ...metadata('2026-08-01T13:01:00.000Z', 'create-record'),
      commandId: 'command-create',
    };
    const first = await createClinicalRecordDraftCommand(
      dependencies,
      professionalActor,
      input,
      commandMetadata
    );
    const replay = await createClinicalRecordDraftCommand(
      dependencies,
      professionalActor,
      input,
      commandMetadata
    );

    expect(first.idempotentReplay).toBe(false);
    expect(replay.idempotentReplay).toBe(true);
    expect(records.listOutboxEvents()).toHaveLength(1);

    const approved = await approveClinicalRecordRevisionCommand(
      dependencies,
      professionalActor,
      first.record.id,
      {
        approvalId: 'approval-1',
        professionalId,
        contentHashSha256: hash,
      },
      {
        ...metadata('2026-08-01T13:02:00.000Z', 'approve-record'),
        commandId: 'command-approve',
      }
    );
    expect(approved.record.status).toBe('approved');
  });

  it('bloqueia outro tenant e usuário que não representa o aprovador', async () => {
    const records = new InMemoryClinicalRecordRepository([draftRecord().record]);
    const sessions = new InMemoryClinicalSessionRepository([endedSession()]);
    const otherTenantActor = {
      ...professionalActor,
      organizationId: 'org-2',
    };
    await expect(
      createClinicalRecordDraftCommand(
        { records, sessions },
        otherTenantActor,
        {
          id: 'record-2',
          revisionId: 'revision-2',
          organizationId,
          patientId,
          sessionId: 'session-1',
          responsibleProfessionalId: professionalId,
          assignedProfessionalIds: [professionalId],
          source: 'manual',
          content,
          retentionUntil: '2031-08-01T13:01:00.000Z',
          createdAt: '2026-08-01T13:01:00.000Z',
        },
        {
          ...metadata('2026-08-01T13:01:00.000Z'),
          commandId: 'cross-tenant',
        }
      )
    ).rejects.toThrow('cross_tenant');
    expect(() =>
      approveClinicalRecordRevisionCommand(
        { records, sessions },
        { ...professionalActor, professionalProfileId: 'professional-2' },
        'record-1',
        {
          approvalId: 'approval-1',
          professionalId,
          contentHashSha256: hash,
        },
        {
          ...metadata('2026-08-01T13:02:00.000Z'),
          commandId: 'invalid-signer',
        }
      )
    ).toThrow('não representa');
  });

  it('detecta escrita concorrente e restringe consultas por organização', async () => {
    const record = draftRecord().record;
    const repository = new InMemoryClinicalRecordRepository([record]);
    await expect(
      repository.commit({
        record: { ...record, version: record.version + 1 },
        expectedVersion: 0,
        commandId: 'stale-command',
        events: [],
      })
    ).rejects.toThrow('Conflito de versão');
    await expect(repository.getById('org-2', record.id)).resolves.toBeNull();
    await expect(
      repository.list({ organizationId: 'org-2' })
    ).resolves.toHaveLength(0);
  });

  it('não concede leitura clínica a proprietário sem papel clínico', async () => {
    const repository = new InMemoryClinicalRecordRepository([
      approvedRecord(),
    ]);
    const accessAudit = new InMemoryClinicalRecordAccessAudit();
    const dependencies = { records: repository, accessAudit };
    const owner: StaffAccessContext = {
      actorType: 'staff',
      organizationId,
      userId: 'user-owner',
      membershipId: 'membership-owner',
      membershipStatus: 'active',
      roles: ['owner'],
    };
    await expect(
      getClinicalRecordForStaff(
        dependencies,
        owner,
        'record-1',
        {
          occurredAt: '2026-08-01T14:00:00.000Z',
          correlationId: 'owner-read',
        }
      )
    ).rejects.toThrow('permission_missing');
    await expect(
      listClinicalRecordsForStaff(
        dependencies,
        owner,
        {},
        {
          occurredAt: '2026-08-01T14:01:00.000Z',
          correlationId: 'owner-list',
        }
      )
    ).rejects.toThrow('permission_missing');
    expect(accessAudit.listEvents()).toHaveLength(2);
    expect(accessAudit.listEvents()[0]).not.toHaveProperty('content');
  });
});

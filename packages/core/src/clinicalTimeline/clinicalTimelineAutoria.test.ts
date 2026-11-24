import { describe, expect, it } from 'vitest';
import {
  InMemoryIdentityRepository,
  createPatientProfile,
  type StaffAccessContext,
} from '../identity';
import {
  InMemoryClinicalTimelineRepository,
  authorizeClinicalTimelineWrite,
  createClinicalTimelineEntry,
  listFormerTimelinePatientsForStaff,
  type ClinicalTimelineCategory,
  type ClinicalTimelineEntry,
} from './index';

/**
 * Autoria depois da transferência (especificação final, § 8.05): o psicólogo
 * consulta e complementa os registros que fez enquanto atendia o paciente,
 * mesmo depois que o vínculo passou a outro profissional.
 */

const organizationId = 'org-ficticia';
const anterior = 'profissional-a';
const sucessor = 'profissional-b';

function staff(professionalProfileId: string | undefined, roles: StaffAccessContext['roles'] = ['professional']): StaffAccessContext {
  return {
    actorType: 'staff',
    organizationId,
    userId: `usuario-${professionalProfileId ?? 'gestao'}`,
    membershipId: `vinculo-${professionalProfileId ?? 'gestao'}`,
    membershipStatus: 'active',
    roles,
    professionalProfileId,
  };
}

function entrada(
  id: string,
  patientId: string,
  autorizados: readonly string[],
  category: ClinicalTimelineCategory = 'clinical_record'
): ClinicalTimelineEntry {
  return createClinicalTimelineEntry({
    id,
    organizationId,
    patientId,
    authorizedProfessionalIds: autorizados,
    category,
    importance: 'routine',
    occurredAt: '2026-09-01T12:00:00.000Z',
    recordedAt: '2026-09-01T12:00:00.000Z',
    title: 'Registro fictício',
    summary: 'Registro fictício para teste de autoria.',
    tags: [],
    evidence: { sourceType: 'clinical_record_revision', sourceId: id, sourceField: 'content' },
  });
}

const paciente = (id: string, displayName: string, responsavel: string) => createPatientProfile({
  id,
  organizationId,
  displayName,
  primaryProfessionalId: responsavel,
  assignedProfessionalIds: [responsavel],
  createdAt: '2026-08-01T10:00:00.000Z',
});

function cenario() {
  const timelines = new InMemoryClinicalTimelineRepository([
    // Paciente transferido de A para B: cada um com os próprios registros.
    entrada('registro-de-a', 'paciente-transferido', [anterior]),
    entrada('registro-de-b', 'paciente-transferido', [sucessor]),
    // Paciente atual de A: não é vínculo encerrado.
    entrada('registro-atual-de-a', 'paciente-atual-de-a', [anterior]),
    // Só evento de agenda autorizado a D: não é prontuário que D registrou.
    entrada('agenda-de-d', 'paciente-transferido', ['profissional-d'], 'appointment'),
  ]);
  const identities = new InMemoryIdentityRepository({
    patients: [
      paciente('paciente-transferido', 'Paciente Transferida', sucessor),
      paciente('paciente-atual-de-a', 'Paciente Atual', anterior),
    ],
  });
  return { timelines, identities };
}

describe('pacientes de vínculos encerrados', () => {
  it('a autora encontra o paciente transferido, sem os pacientes que ainda atende', async () => {
    expect(await listFormerTimelinePatientsForStaff(cenario(), staff(anterior))).toEqual([
      { patientId: 'paciente-transferido', displayName: 'Paciente Transferida' },
    ]);
  });

  it('o responsável atual, um terceiro e quem só tem evento de agenda não recebem nada', async () => {
    expect(await listFormerTimelinePatientsForStaff(cenario(), staff(sucessor))).toEqual([]);
    expect(await listFormerTimelinePatientsForStaff(cenario(), staff('profissional-sem-vinculo'))).toEqual([]);
    expect(await listFormerTimelinePatientsForStaff(cenario(), staff('profissional-d'))).toEqual([]);
  });

  it('a Gestão não consulta vínculos clínicos', async () => {
    await expect(listFormerTimelinePatientsForStaff(cenario(), staff(undefined, ['admin'])))
      .rejects.toThrow('permission_missing');
  });
});

describe('quem grava no prontuário', () => {
  const transferido = paciente('paciente-transferido', 'Paciente Transferida', sucessor);

  it('o responsável atual registra normalmente', async () => {
    expect(await authorizeClinicalTimelineWrite(cenario().timelines, staff(sucessor), transferido))
      .toBe('vinculo_atual');
  });

  it('a autora de registros anteriores grava como complemento depois da transferência', async () => {
    expect(await authorizeClinicalTimelineWrite(cenario().timelines, staff(anterior), transferido))
      .toBe('complemento_do_autor');
  });

  it('sem prontuário próprio, quem não é o responsável continua barrado', async () => {
    await expect(authorizeClinicalTimelineWrite(cenario().timelines, staff('profissional-d'), transferido))
      .rejects.toThrow('professional_not_assigned');
    await expect(authorizeClinicalTimelineWrite(cenario().timelines, staff('profissional-sem-vinculo'), transferido))
      .rejects.toThrow('professional_not_assigned');
  });

  it('a Gestão não grava prontuário', async () => {
    await expect(authorizeClinicalTimelineWrite(cenario().timelines, staff(undefined, ['admin']), transferido))
      .rejects.toThrow('permission_missing');
  });
});

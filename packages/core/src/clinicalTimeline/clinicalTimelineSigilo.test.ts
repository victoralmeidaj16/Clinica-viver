import { describe, expect, it } from 'vitest';
import {
  InMemoryIdentityRepository,
  createPatientProfile,
  type StaffAccessContext,
} from '../identity';
import {
  InMemoryClinicalTimelineAccessAudit,
  InMemoryClinicalTimelineRepository,
  createClinicalTimelineEntry,
  listClinicalTimelineForStaff,
  searchClinicalTimelineForStaff,
  type ClinicalTimelineEntry,
} from './index';

/**
 * Sigilo na troca de psicólogo (especificação final, §§ 8.05, 6.09 e 13.03).
 *
 * O paciente foi transferido da psicóloga A para o psicólogo B. Cada entrada
 * guarda quem estava autorizado quando foi registrada; a leitura segue essa
 * autoria e o período do vínculo, e não o responsável atual do paciente.
 */

const organizationId = 'org-ficticia';
const patientId = 'paciente-ficticio';
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

function entrada(id: string, autorizados: readonly string[], texto: string, occurredAt: string): ClinicalTimelineEntry {
  return createClinicalTimelineEntry({
    id,
    organizationId,
    patientId,
    authorizedProfessionalIds: autorizados,
    category: 'clinical_record',
    importance: 'routine',
    occurredAt,
    recordedAt: occurredAt,
    title: 'Evolução clínica manual',
    summary: 'Registro fictício para teste de sigilo.',
    evidenceExcerpt: texto,
    tags: ['prontuario-manual'],
    evidence: { sourceType: 'clinical_record_revision', sourceId: id, sourceField: 'content' },
  });
}

async function cenarioTransferido() {
  const timelines = new InMemoryClinicalTimelineRepository();
  await timelines.upsert([
    entrada('registro-de-a', [anterior], 'Tema sigiloso registrado pela psicóloga anterior.', '2026-09-01T12:00:00.000Z'),
    entrada('registro-de-b', [sucessor], 'Primeira sessão com o novo psicólogo.', '2026-11-01T12:00:00.000Z'),
  ]);
  const identities = new InMemoryIdentityRepository({
    patients: [createPatientProfile({
      id: patientId,
      organizationId,
      displayName: 'Paciente Fictício',
      // Depois da transferência, só o sucessor é responsável.
      primaryProfessionalId: sucessor,
      assignedProfessionalIds: [sucessor],
      createdAt: '2026-08-01T10:00:00.000Z',
    })],
  });
  const audit = new InMemoryClinicalTimelineAccessAudit();
  return { dependencies: { timelines, identities, audit }, audit };
}

const metadata = (correlationId: string) => ({ occurredAt: '2026-11-23T12:00:00.000Z', correlationId });

describe('sigilo da linha do tempo na troca de psicólogo', () => {
  it('o sucessor não vê registros anteriores ao seu vínculo', async () => {
    const { dependencies, audit } = await cenarioTransferido();

    const entradas = await listClinicalTimelineForStaff(dependencies, staff(sucessor), { patientId }, metadata('lista-b'));

    expect(entradas.map((item) => item.id)).toEqual(['registro-de-b']);
    // A auditoria conta só o que foi entregue, sem revelar quantas entradas foram ocultadas.
    expect(audit.listEvents().at(-1)?.resultCount).toBe(1);
  });

  it('a busca do sucessor não encontra o conteúdo do profissional anterior', async () => {
    const { dependencies } = await cenarioTransferido();

    const busca = await searchClinicalTimelineForStaff(
      dependencies, staff(sucessor), { patientId, query: 'sigiloso' }, metadata('busca-b'),
    );

    expect(busca.matches).toEqual([]);
    expect(JSON.stringify(busca)).not.toContain('psicóloga anterior');
  });

  it('a autora continua lendo e buscando os próprios registros depois da transferência', async () => {
    const { dependencies } = await cenarioTransferido();

    const entradas = await listClinicalTimelineForStaff(dependencies, staff(anterior), { patientId }, metadata('lista-a'));
    const busca = await searchClinicalTimelineForStaff(
      dependencies, staff(anterior), { patientId, query: 'sigiloso' }, metadata('busca-a'),
    );

    expect(entradas.map((item) => item.id)).toEqual(['registro-de-a']);
    expect(busca.matches.map((match) => match.entry.id)).toEqual(['registro-de-a']);
  });

  it('um psicólogo sem vínculo nem autoria continua sem acesso', async () => {
    const { dependencies } = await cenarioTransferido();

    await expect(listClinicalTimelineForStaff(
      dependencies, staff('profissional-sem-vinculo'), { patientId }, metadata('lista-c'),
    )).rejects.toThrow('professional_not_assigned');
  });

  it('a Gestão continua sem acesso ao conteúdo clínico', async () => {
    const { dependencies } = await cenarioTransferido();

    await expect(listClinicalTimelineForStaff(
      dependencies, staff(undefined, ['admin']), { patientId }, metadata('lista-gestao'),
    )).rejects.toThrow('permission_missing');
  });
});

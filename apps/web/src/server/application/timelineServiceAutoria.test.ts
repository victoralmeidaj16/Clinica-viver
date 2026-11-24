import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatientProfile, type ClinicalTimelineEntry } from '@thats-life/core';
import type { RequestContext } from './context';

vi.mock('server-only', () => ({}));

const store = vi.hoisted(() => ({
  getPatient: vi.fn(),
  upsert: vi.fn(),
  list: vi.fn(),
}));
vi.mock('./store', () => ({
  getApplicationStore: () => ({
    identities: { getPatient: store.getPatient },
    timeline: { upsert: store.upsert, list: store.list },
  }),
  persistApplicationState: async () => {},
}));

import { createManualClinicalRecord } from './timelineService';

const context: RequestContext = {
  actor: {
    actorType: 'staff', organizationId: 'org-ficticia', userId: 'usuario-autor', membershipId: 'vinculo-autor',
    membershipStatus: 'active', roles: ['professional'], professionalProfileId: 'profissional-autor',
  },
  idempotencyKey: 'chave-ficticia',
  correlationId: 'correlacao-ficticia',
};

const input = {
  patientId: 'paciente-ficticio', title: 'Sessão fictícia',
  subjective: 'Relato fictício.', objective: '', assessment: '', plan: '',
};

describe('prontuário manual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    store.upsert.mockResolvedValue(undefined);
    store.list.mockResolvedValue([]);
  });

  it('autoriza somente o autor, mesmo com outro profissional também atribuído ao paciente', async () => {
    // Especificação final, § 8.05 e regras gerais: o psicólogo só acessa os
    // prontuários que ele próprio registrou.
    store.getPatient.mockResolvedValue(createPatientProfile({
      id: 'paciente-ficticio', organizationId: 'org-ficticia', displayName: 'Paciente Fictício',
      primaryProfessionalId: 'profissional-autor',
      assignedProfessionalIds: ['profissional-autor', 'outro-profissional'],
      createdAt: '2026-11-01T10:00:00.000Z',
    }));

    const { entries } = await createManualClinicalRecord(context, input);

    expect(entries.map((entry) => entry.authorizedProfessionalIds)).toEqual([['profissional-autor']]);
    const gravadas = store.upsert.mock.calls[0][0] as readonly ClinicalTimelineEntry[];
    expect(gravadas[0].authorizedProfessionalIds).toEqual(['profissional-autor']);
  });

  it('a autora de registros anteriores grava um complemento depois da transferência', async () => {
    // Especificação final, § 8.05: complementar os próprios registros mesmo
    // depois do fim do vínculo, sem alterar o registro original.
    store.getPatient.mockResolvedValue(createPatientProfile({
      id: 'paciente-ficticio', organizationId: 'org-ficticia', displayName: 'Paciente Fictício',
      primaryProfessionalId: 'outro-profissional', assignedProfessionalIds: ['outro-profissional'],
      createdAt: '2026-11-01T10:00:00.000Z',
    }));
    store.list.mockResolvedValue([{ authorizedProfessionalIds: ['profissional-autor'], category: 'clinical_record' }]);

    const { entries } = await createManualClinicalRecord(context, input);

    expect(entries[0].authorizedProfessionalIds).toEqual(['profissional-autor']);
    expect(entries[0].tags).toContain('complemento');
    expect(entries[0].summary).toContain('Complemento registrado depois do fim do vínculo');
    expect(store.list).toHaveBeenCalledWith(expect.objectContaining({ categories: ['clinical_record'] }));
  });

  it('continua exigindo o vínculo atual para registrar', async () => {
    store.getPatient.mockResolvedValue(createPatientProfile({
      id: 'paciente-ficticio', organizationId: 'org-ficticia', displayName: 'Paciente Fictício',
      primaryProfessionalId: 'outro-profissional', assignedProfessionalIds: ['outro-profissional'],
      createdAt: '2026-11-01T10:00:00.000Z',
    }));

    await expect(createManualClinicalRecord(context, input)).rejects.toThrow('professional_not_assigned');
    expect(store.upsert).not.toHaveBeenCalled();
  });
});

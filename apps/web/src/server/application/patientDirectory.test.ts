import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatientProfile, type PatientProfile } from '@thats-life/core';
import type { CaptureResult, CaptureState } from '@/server/persistence/captureRepository';
import type { RequestContext } from './context';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  patients: new Map<string, PatientProfile>(),
  listPatients: vi.fn(),
  capture: { triagensPacientes: [], cadastrosPsicologos: [] } as CaptureState,
}));
vi.mock('./store', () => ({
  getApplicationStore: () => ({ appointments: { list: async () => [] }, identities: {
    listPatients: state.listPatients,
    getPatient: async (_organizationId: string, id: string) => state.patients.get(id),
    savePatient: async (patient: PatientProfile) => { state.patients.set(patient.id, patient); },
    getProfessional: async () => ({ id: 'professional-roster-1', displayName: 'Profissional fictício' }),
  } }),
  persistApplicationState: vi.fn(async () => {}),
}));
vi.mock('@/server/persistence/captureRepository', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/server/persistence/captureRepository')>(),
  getCaptureRepository: () => ({
    read: async () => state.capture,
    mutate: async <T>(mutator: (capture: CaptureState) => CaptureResult<T>) => {
      const change = mutator(state.capture);
      state.capture = change.next;
      return change.result;
    },
  }),
}));
vi.mock('@/server/oci/runtime', () => ({ isMysqlConfigured: () => false, getMysqlPool: vi.fn() }));

vi.mock('./persistence', async (importOriginal) => ({
  ...await importOriginal<typeof import('./persistence')>(), readSnapshot: () => null,
}));

import { createPatient, listPatientDirectory } from './patientDirectory';

const context: RequestContext = {
  actor: {
    actorType: 'staff', membershipStatus: 'active', membershipId: 'member-1',
    organizationId: 'org-test', userId: 'user-test', roles: ['professional'],
    professionalProfileId: 'professional-roster-1',
  },
  idempotencyKey: 'command-test', correlationId: 'correlation-test',
};
const body = {
  nome: 'Paciente Fictício', legalName: 'Paciente Fictício', whatsapp: '(11) 99999-9999',
  email: 'test@example.com', cpf: '52998224725', genero: 'FEMININO',
  servicoKey: 'PSICOTERAPIA', modalidade: 'SOCIAL', turno: 'TARDE',
  cep: '01310100', logradouro: 'Avenida fictícia', numeroResidencia: '100',
  bairro: 'Centro', cidade: 'São Paulo', uf: 'SP',
};

beforeEach(() => {
  state.patients.clear();
  state.listPatients.mockClear();
  state.listPatients.mockImplementation(async () => [...state.patients.values()]);
  state.capture = {
    triagensPacientes: [],
    cadastrosPsicologos: ['roster-1', 'roster-2'].map((id) => ({
      id, profissionalRef: `professional-${id}`, nomeCompleto: 'Profissional fictício',
      crp: '00/00000', whatsapp: '11999999999', status: 'APROVADO',
      criadoEm: '2026-01-01T12:00:00.000Z', pacientesAtivosCount: 0,
    })),
  };
});

describe('cadastro manual de paciente', () => {
  it('usa o cadastro público no rodízio e contabiliza cada paciente confirmado', async () => {
    const first = await createPatient(context, body);
    await createPatient(context, { ...body, nome: 'Segundo Paciente' });

    expect(first.primaryProfessionalId).toBe('professional-roster-1');
    expect(state.capture.triagensPacientes[0]).toMatchObject({
      pacienteRef: first.id, status: 'CONTATO_CONFIRMADO',
      psicologoAlocadoId: 'roster-1', psicologosJaTentados: ['roster-1'],
    });
    expect(state.capture.cadastrosPsicologos.map((item) => item.pacientesAtivosCount)).toEqual([2, 0]);
  });

  it('preserva a idade e o nome social validados na triagem', async () => {
    await createPatient(context, { ...body, idade: '34', nomeSocial: '  Nome Social  ' });
    expect(state.capture.triagensPacientes[0]).toMatchObject({ idade: '34', nomeSocial: 'Nome Social' });
  });

  it('mantém os campos opcionais ausentes quando não informados', async () => {
    await createPatient(context, body);
    expect(state.capture.triagensPacientes[0].idade).toBeUndefined();
    expect(state.capture.triagensPacientes[0].nomeSocial).toBeUndefined();
  });

  it('não duplica a capacidade ao reenviar um cadastro com o mesmo id', async () => {
    await createPatient(context, { ...body, id: 'patient-fixed' });
    await createPatient(context, { ...body, id: 'patient-fixed' });
    expect(state.capture.triagensPacientes).toHaveLength(1);
    expect(state.capture.cadastrosPsicologos[0].pacientesAtivosCount).toBe(1);
  });

  it('não inventa vínculo de rodízio quando só existe o perfil clínico', async () => {
    state.capture.cadastrosPsicologos = [];
    const patient = await createPatient(context, body);
    expect(patient.primaryProfessionalId).toBe('professional-roster-1');
    expect(state.capture.triagensPacientes[0].psicologoAlocadoId).toBeUndefined();
    expect(state.capture.triagensPacientes[0].psicologosJaTentados).toEqual([]);
  });
});


describe('escopo do diretório de pacientes', () => {
  beforeEach(() => {
    for (const professionalId of ['professional-roster-1', 'other']) {
      const patient = createPatientProfile({ id: professionalId, organizationId: 'org-test', displayName: 'Paciente fictício',
        primaryProfessionalId: professionalId, assignedProfessionalIds: [professionalId], createdAt: '2026-01-01T12:00:00.000Z' });
      state.patients.set(patient.id, patient);
    }
  });
  it('recusa profissional sem perfil antes de ler dados', async () => {
    await expect(listPatientDirectory({ ...context, actor: { ...context.actor, professionalProfileId: undefined } })).rejects.toMatchObject({ status: 403 });
    expect(state.listPatients).not.toHaveBeenCalled();
  });
  it('mostra apenas pacientes vinculados ao profissional', async () => {
    expect((await listPatientDirectory(context)).map((patient) => patient.id)).toEqual(['professional-roster-1']);
  });
  it('preserva o acesso administrativo sem perfil clínico', async () => {
    expect(await listPatientDirectory({ ...context, actor: { ...context.actor, roles: ['admin'], professionalProfileId: undefined } })).toHaveLength(2);
  });
});

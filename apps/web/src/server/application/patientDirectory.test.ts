import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPatientProfile, InMemoryAppointmentRepository, type Appointment, type PatientProfile } from '@thats-life/core';
import type { CaptureResult, CaptureState } from '@/server/persistence/captureRepository';
import type { RequestContext } from './context';

vi.mock('server-only', () => ({}));
const state = vi.hoisted(() => ({
  patients: new Map<string, PatientProfile>(),
  listPatients: vi.fn(),
  listAppointments: vi.fn(),
  getRegistration: vi.fn(),
  updateRegistration: vi.fn(),
  welcome: vi.fn(),
  capture: { triagensPacientes: [], cadastrosPsicologos: [] } as CaptureState,
}));
vi.mock('./viverMaisWhatsApp', () => ({ avisarConfirmacaoPaciente: state.welcome }));
vi.mock('./store', () => ({
  getApplicationStore: () => ({ appointments: { list: state.listAppointments }, identities: {
    listPatients: state.listPatients,
    getPatientRegistration: state.getRegistration,
    updatePatientRegistration: state.updateRegistration,
    getPatient: async (_organizationId: string, id: string) => state.patients.get(id),
    savePatient: async (patient: PatientProfile) => { state.patients.set(patient.id, patient); },
    getProfessional: async () => ({ id: 'professional-roster-1', displayName: 'Profissional fictício', status: 'active' }),
    reassignPatient: async ({ patientId, professionalId }: { patientId: string; professionalId: string }) => {
      const patient = state.patients.get(patientId);
      if (!patient) return null;
      const next = { ...patient, primaryProfessionalId: professionalId, assignedProfessionalIds: [professionalId] };
      state.patients.set(patientId, next);
      return next;
    },
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
  writeSnapshot: vi.fn(async () => {}),
}));

import { createPatient, listPatientDirectory, registerPatientDropout, getPatientRegistration, updatePatientRegistration, reassignPatient } from './patientDirectory';
import { notificacoesDoPsicologo } from './notificacoes';
import { writeSnapshot } from './persistence';

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
  state.welcome.mockReset().mockResolvedValue({ situacao: 'enviada' });
  vi.mocked(writeSnapshot).mockClear();
  state.patients.clear();
  state.listPatients.mockClear();
  state.listAppointments.mockReset().mockResolvedValue([]);
  state.listPatients.mockImplementation(async () => [...state.patients.values()]);
  state.capture = {
    triagensPacientes: [],
    cadastrosPsicologos: ['roster-1', 'roster-2'].map((id) => ({
      id, profissionalRef: `professional-${id}`, nomeCompleto: 'Profissional fictício',
      crp: '00/00000', whatsapp: '11999999999', status: 'APROVADO',
      criadoEm: '2026-01-01T12:00:00.000Z', pacientesAtivosCount: 0,
      modalidadesAtendidas: ['ACESSIVEL_SOCIAL'], servicosHabilitados: ['PSICOTERAPIA'],
    })),
  };
});

describe('desistência registrada pelo psicólogo', () => {
  it('persiste a triagem vinculada e libera a vaga, ignorando leadId do cliente', async () => {
    const patient = await createPatient(context, body);
    const leadId = state.capture.triagensPacientes[0].id;
    const dropout = await registerPatientDropout(context, {
      patientId: patient.id, motivo: 'FINANCEIRO', leadId: 'triagem-de-outro-paciente',
    });

    expect(dropout).toMatchObject({ pacienteId: patient.id, leadId });
    expect(writeSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      auditoriaDesistencias: [expect.objectContaining({ pacienteId: patient.id, leadId })],
    }));
    expect(state.patients.get(patient.id)?.status).toBe('discharged');
    expect(state.capture.triagensPacientes[0].status).toBe('DESISTENTE');
    expect(state.capture.cadastrosPsicologos[0].pacientesAtivosCount).toBe(0);
  });

  it('permite registrar saída sem inventar triagem quando o paciente não tem vínculo', async () => {
    const patient = await createPatient(context, body);
    state.capture.triagensPacientes = [];
    const dropout = await registerPatientDropout(context, { patientId: patient.id, motivo: 'FINANCEIRO' });
    expect(dropout.leadId).toBeUndefined();
    expect(state.patients.get(patient.id)?.status).toBe('discharged');
  });
});

describe('cadastro manual de paciente', () => {
  it.each([
    { modalidade: 'PARTICULAR' },
    { servicoKey: 'AVALIACAO' },
  ])('recusa opções sem habilitação antes de salvar: %j', async (opcao) => {
    await expect(createPatient(context, { ...body, ...opcao })).rejects.toMatchObject({ status: 403 });
    expect(state.patients.size).toBe(0);
    expect(state.capture.triagensPacientes).toEqual([]);
    expect(state.welcome).not.toHaveBeenCalled();
  });

  it('envia as boas-vindas somente após persistir o paciente e sua triagem confirmada', async () => {
    state.welcome.mockImplementation(async (lead) => {
      expect(state.patients.has(lead.pacienteRef)).toBe(true);
      expect(state.capture.triagensPacientes).toContainEqual(lead);
      return { situacao: 'enviada' };
    });
    const patient = await createPatient(context, body);
    await createPatient(context, body);
    expect(state.welcome).toHaveBeenCalledOnce();
    expect(state.welcome).toHaveBeenCalledWith(expect.objectContaining({
      pacienteRef: patient.id, status: 'CONTATO_CONFIRMADO', telefone: expect.any(String),
    }));
  });

  it('preserva o cadastro se o envio de boas-vindas falhar', async () => {
    state.welcome.mockRejectedValue(new Error('Provedor indisponível'));
    const patient = await createPatient(context, body);
    expect(state.welcome).toHaveBeenCalledOnce();
    expect(state.patients.get(patient.id)).toEqual(patient);
  });

  it('reenvia o mesmo comando sem criar outro paciente ou triagem', async () => {
    const first = await createPatient(context, body);
    const second = await createPatient(context, { ...body, id: 'outro-id' });
    expect(second.id).toBe(first.id);
    expect(state.patients.size).toBe(1);
    expect(state.capture.triagensPacientes).toHaveLength(1);
  });
  it('usa o cadastro público no rodízio e contabiliza cada paciente confirmado', async () => {
    const first = await createPatient(context, body);
    await createPatient({ ...context, idempotencyKey: 'command-test-2' }, { ...body, nome: 'Segundo Paciente' });

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

  it('impede o psicólogo de cadastrar paciente no perfil de outro psicólogo', async () => {
    await expect(createPatient(context, { ...body, professionalId: 'professional-roster-2' }))
      .rejects.toMatchObject({ status: 403 });
    expect(state.patients.size).toBe(0);
    expect(state.capture.triagensPacientes).toHaveLength(0);
    expect(state.welcome).not.toHaveBeenCalled();
  });

  it('vincula ao próprio perfil quando o corpo não informa o profissional', async () => {
    const patient = await createPatient(context, body);
    expect(patient).toMatchObject({
      primaryProfessionalId: 'professional-roster-1', assignedProfessionalIds: ['professional-roster-1'],
    });
  });

  it('recusa cadastro sem nome antes de gravar', async () => {
    await expect(createPatient(context, { ...body, nome: '  ', legalName: undefined }))
      .rejects.toMatchObject({ status: 400 });
    expect(state.patients.size).toBe(0);
  });

  it('registra o convênio escolhido na triagem do paciente conveniado', async () => {
    await createPatient(context, {
      ...body, possuiConvenio: 'SIM', convenioSelecionado: 'Convênio Fictício',
    });
    expect(state.capture.triagensPacientes[0]).toMatchObject({
      possuiConvenio: 'SIM', convenioSelecionado: 'Convênio Fictício',
    });
  });

  it('descarta convênio informado quando a modalidade é particular', async () => {
    state.capture.cadastrosPsicologos[0].modalidadesAtendidas = ['PARTICULAR'];
    await createPatient(context, {
      ...body, modalidade: 'PARTICULAR', possuiConvenio: 'SIM', convenioSelecionado: 'Convênio Fictício',
    });
    expect(state.capture.triagensPacientes[0]).toMatchObject({ possuiConvenio: 'NAO', convenioSelecionado: 'Nenhum' });
  });

  it('recusa cadastro pelo psicólogo sem habilitações vinculadas ao perfil clínico', async () => {
    state.capture.cadastrosPsicologos = [];
    await expect(createPatient(context, body)).rejects.toMatchObject({ status: 403 });
    expect(state.patients.size).toBe(0);
    expect(state.capture.triagensPacientes).toEqual([]);
    expect(state.welcome).not.toHaveBeenCalled();
  });
});

describe('notificação após encaminhar paciente confirmado', () => {
  it('mostra a nova atribuição sem herdar o primeiro contato do psicólogo anterior', async () => {
    const patient = await createPatient(context, body);
    const contatoAntigo = '2026-10-20T12:00:00.000Z';
    state.capture.triagensPacientes = state.capture.triagensPacientes.map((lead) => ({ ...lead,
      alocadoEm: contatoAntigo, aceitoEm: contatoAntigo, confirmadoEm: contatoAntigo }));
    const admin: RequestContext = { ...context, actor: { ...context.actor, roles: ['admin'] } };
    await reassignPatient(admin, { id: patient.id, professionalId: 'professional-roster-2', motivo: 'Troca solicitada' });

    const novo = state.capture.cadastrosPsicologos[1];
    const avisos = notificacoesDoPsicologo(state.capture, novo).filter((item) => item.chave.includes(state.capture.triagensPacientes[0].id));
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatchObject({ tipo: 'paciente-encaminhado', titulo: 'Paciente encaminhado para você',
      ocorridoEm: state.capture.triagensPacientes[0].alocadoEm, pendente: false });
    expect(avisos[0].ocorridoEm).not.toBe(contatoAntigo);
    expect(state.capture.triagensPacientes[0].confirmadoEm).toBe(contatoAntigo);
    expect(state.capture.cadastrosPsicologos.map((item) => item.pacientesAtivosCount)).toEqual([0, 1]);

    await reassignPatient(admin, { id: patient.id, professionalId: 'professional-roster-2', motivo: 'Reenvio' });
    const repetidos = notificacoesDoPsicologo(state.capture, state.capture.cadastrosPsicologos[1])
      .filter((item) => item.tipo === 'paciente-encaminhado');
    expect(repetidos.map((item) => item.chave)).toEqual([avisos[0].chave]);
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

  function agendamentosDoPacienteEncaminhado(incluirNovoProfissional: boolean) {
    const base: Appointment = {
      schemaVersion: 1, id: 'antigo-futuro', organizationId: 'org-test',
      patientId: 'professional-roster-1', professionalId: 'other',
      startsAt: '2099-01-10T14:00:00Z', endsAt: '2099-01-10T14:50:00Z',
      timezone: 'America/Sao_Paulo', mode: 'video', status: 'scheduled', reminders: [],
      version: 1, createdAt: '2026-01-01T12:00:00Z', updatedAt: '2026-01-01T12:00:00Z',
    };
    const appointments = new InMemoryAppointmentRepository([
      base,
      { ...base, id: 'antigo-concluido', status: 'completed',
        startsAt: '2026-01-10T14:00:00Z', endsAt: '2026-01-10T14:50:00Z' },
      ...(incluirNovoProfissional ? [
        { ...base, id: 'novo-futuro', professionalId: 'professional-roster-1',
          startsAt: '2099-02-10T14:00:00Z', endsAt: '2099-02-10T14:50:00Z' },
        { ...base, id: 'novo-concluido', professionalId: 'professional-roster-1', status: 'completed' as const,
          startsAt: '2026-02-10T14:00:00Z', endsAt: '2026-02-10T14:50:00Z' },
      ] : []),
    ]);
    state.listAppointments.mockImplementation((filter) => appointments.list(filter));
    return appointments;
  }

  it('paciente encaminhado chega sem sessões do psicólogo anterior na nova carteira', async () => {
    const appointments = agendamentosDoPacienteEncaminhado(false);
    const directory = await listPatientDirectory(context);
    expect(directory[0]).toMatchObject({ id: 'professional-roster-1', completedSessions: 0 });
    expect(directory[0].nextAppointmentAt).toBeUndefined();
    expect(await appointments.list({ organizationId: 'org-test', professionalId: 'other' })).toHaveLength(2);
  });

  it('calcula próxima sessão e total apenas com os atendimentos do novo psicólogo', async () => {
    agendamentosDoPacienteEncaminhado(true);
    const directory = await listPatientDirectory(context);
    expect(directory[0]).toMatchObject({ completedSessions: 1, nextAppointmentAt: '2099-02-10T14:00:00Z' });
    expect(state.listAppointments).toHaveBeenCalledWith({ organizationId: 'org-test', professionalId: 'professional-roster-1' });
  });

  it('mantém todo o histórico de agendamentos visível para a gestão', async () => {
    agendamentosDoPacienteEncaminhado(true);
    const directory = await listPatientDirectory({ ...context, actor: { ...context.actor, roles: ['admin'] } });
    expect(directory[0]).toMatchObject({ completedSessions: 2, nextAppointmentAt: '2099-01-10T14:00:00Z' });
    expect(state.listAppointments).toHaveBeenCalledWith({ organizationId: 'org-test' });
  });
});


describe('edição cadastral pela gestão', () => {
  const admin: RequestContext = { ...context, actor: { ...context.actor, roles: ['admin'], professionalProfileId: undefined } };
  beforeEach(() => {
    state.getRegistration.mockReset().mockResolvedValue({ patientId: 'patient-1', legalName: 'Nome atual' });
    state.updateRegistration.mockReset().mockResolvedValue({ patientId: 'patient-1', legalName: 'Nome corrigido' });
    state.patients.set('patient-1', createPatientProfile({ id: 'patient-1', organizationId: 'org-test',
      displayName: 'Paciente', primaryProfessionalId: 'other', assignedProfessionalIds: ['other'],
      createdAt: '2026-01-01T12:00:00.000Z' }));
  });
  it('admin sem perfil clínico abre e salva o cadastro com autoria da sessão', async () => {
    await expect(getPatientRegistration(admin, 'patient-1')).resolves.toMatchObject({ legalName: 'Nome atual' });
    await expect(updatePatientRegistration(admin, 'patient-1', { ...body, expectedUpdatedAt: null, expectedCpf: body.cpf, actorUserId: 'forjado' }))
      .resolves.toMatchObject({ legalName: 'Nome corrigido' });
    expect(state.updateRegistration).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org-test', patientId: 'patient-1', actorUserId: 'user-test', changedAt: expect.any(String),
    }));
  });
  it('recusa CPF inválido antes de salvar', async () => {
    await expect(updatePatientRegistration(admin, 'patient-1', { ...body, cpf: '123' })).rejects.toMatchObject({ status: 400 });
    expect(state.updateRegistration).not.toHaveBeenCalled();
  });
  it('mantém o bloqueio para psicólogo não responsável', async () => {
    await expect(updatePatientRegistration(context, 'patient-1', body)).rejects.toThrow('professional_not_assigned');
    expect(state.updateRegistration).not.toHaveBeenCalled();
  });
  it('recusa papel financeiro sem permissão de escrita', async () => {
    await expect(updatePatientRegistration({ ...admin, actor: { ...admin.actor, roles: ['billing'] } }, 'patient-1', body))
      .rejects.toThrow('permission_missing');
    expect(state.updateRegistration).not.toHaveBeenCalled();
  });
  it('recusa vínculo inativo mesmo para admin', async () => {
    await expect(updatePatientRegistration({ ...admin, actor: { ...admin.actor, membershipStatus: 'disabled' } }, 'patient-1', body))
      .rejects.toThrow('inactive_membership');
    expect(state.updateRegistration).not.toHaveBeenCalled();
  });
});

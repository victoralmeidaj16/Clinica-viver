import { assertStaffAuthorized, createPatientProfile, type PatientProfile } from '@thats-life/core';
import type { PatientContact, PatientContactCapable, PatientRegistrationCapable } from '@/server/persistence/mysql/identityRepository';
import { validatePatientRegistrationDetails, type PatientRegistrationRecord, type PatientRegistrationUpdate } from '@/lib/patientRegistrationDetails';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getApplicationStore, persistApplicationState } from './store';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { recalcularPacientesAtivos } from './viverMaisRodizio';
import { motivoValido } from '@/lib/desistencias';
import { validarSubmissaoTriagem } from '@/lib/triagemSubmissao';
import {
  emptySnapshot,
  readSnapshot,
  writeSnapshot,
  type AuditoriaDesistenciaRecord,
} from './persistence';
import { isMysqlConfigured, getMysqlPool } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';
import type { RowDataPacket } from 'mysql2/promise';

/**
 * Cadastro de pacientes visto pela equipe.
 *
 * As rotas em `api/application/patient/*` são do portal do paciente e resolvem
 * o contexto pelo próprio usuário. Esta é a fronteira da equipe: exige vínculo
 * organizacional e permissão, e é o que permite a tela `/pacientes` deixar de
 * ler uma constante do bundle.
 */

export interface PatientDirectoryEntry {
  id: string;
  displayName: string;
  status: PatientProfile['status'];
  birthDate?: string;
  phone?: string;
  email?: string;
  primaryProfessionalId?: string;
  professionalName?: string;
  /** Próximo agendamento não cancelado, em ISO 8601. */
  nextAppointmentAt?: string;
  /** Sessões efetivamente realizadas — não agendadas. */
  completedSessions: number;
  /** Há uma desistência aberta para este paciente na auditoria de retenção. */
  dropoutRegistered: boolean;
  lastRegistrationUpdate?: PatientRegistrationUpdate;
  conveniado?: boolean;
  convenioNome?: string;
}

function contactSource(identities: unknown): PatientContactCapable | null {
  const candidate = identities as Partial<PatientContactCapable>;
  return typeof candidate.listPatientContacts === 'function' ? (candidate as PatientContactCapable) : null;
}

function registrationSource(identities: unknown): PatientRegistrationCapable | null {
  const candidate = identities as Partial<PatientRegistrationCapable>;
  return typeof candidate.getPatientRegistration === 'function' && typeof candidate.updatePatientRegistration === 'function'
    ? candidate as PatientRegistrationCapable : null;
}

export async function listPatientDirectory(context: RequestContext): Promise<readonly PatientDirectoryEntry[]> {
  assertStaffAuthorized(context.actor, 'patients.read', { organizationId: context.actor.organizationId });

  const store = getApplicationStore();
  const organizationId = context.actor.organizationId;
  const contacts = contactSource(store.identities);

  const [patients, appointments, contactMap, capture, mysqlAgreementRows] = await Promise.all([
    store.identities.listPatients(organizationId),
    store.appointments.list({ organizationId }),
    contacts ? contacts.listPatientContacts(organizationId) : Promise.resolve<Record<string, PatientContact>>({}),
    getCaptureRepository().read(),
    isMysqlConfigured()
      ? getMysqlPool()
          .query<RowDataPacket[]>(
            `SELECT p.ref_core, p.convenio_ref, p.custeado_pela_empresa,
                    c.nome AS convenio_nome
               FROM clinica_pacientes p
               JOIN clinica_organizacoes o ON o.id = p.organizacao_id
               LEFT JOIN clinica_convenios c ON c.instituicao_id = p.instituicao_id
                AND c.organizacao_ref = o.ref_core AND c.ref_core = p.convenio_ref
              WHERE p.instituicao_id = ? AND o.ref_core = ?`,
            [instituicaoId(), organizationId]
          )
          .then(([rows]) => rows)
          .catch(() => [] as RowDataPacket[])
      : Promise.resolve([] as RowDataPacket[]),
  ]);

  const agreementsByPatient = new Map(mysqlAgreementRows.map((r) => [String(r.ref_core), r]));
  const leadsByPatient = new Map(
    capture.triagensPacientes
      .filter((lead) => lead.pacienteRef)
      .map((lead) => [lead.pacienteRef!, lead])
  );

  // Papel clínico enxerga apenas os pacientes atribuídos a si. Papéis
  // administrativos veem a lista inteira — cadastro não é prontuário.
  const professionalId = context.actor.professionalProfileId;
  const clinicalOnly =
    context.actor.roles.includes('professional') &&
    !context.actor.roles.some((role) => role === 'owner' || role === 'admin' || role === 'clinical_director');
  const visible =
    clinicalOnly && professionalId
      ? patients.filter((patient) => patient.assignedProfessionalIds.includes(professionalId))
      : patients;

  const now = Date.now();
  const openDropouts = new Set(
    (readSnapshot()?.auditoriaDesistencias ?? [])
      .filter(
        (dropout) =>
          !dropout.reengajado &&
          (!dropout.organizationId || dropout.organizationId === organizationId)
      )
      .map((dropout) => dropout.pacienteId)
      .filter((patientId): patientId is string => Boolean(patientId))
  );
  const professionalNames = new Map<string, string>();
  for (const patient of visible) {
    if (!patient.primaryProfessionalId || professionalNames.has(patient.primaryProfessionalId)) continue;
    const professional = await store.identities.getProfessional(organizationId, patient.primaryProfessionalId);
    if (professional) professionalNames.set(patient.primaryProfessionalId, professional.displayName);
  }

  return visible.map((patient) => {
    const own = appointments.filter((appointment) => appointment.patientId === patient.id);
    const next = own
      .filter(
        (appointment) =>
          Date.parse(appointment.startsAt) >= now &&
          (appointment.status === 'scheduled' || appointment.status === 'confirmed')
      )
      .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))[0];

    const agreement = agreementsByPatient.get(patient.id);
    const lead = leadsByPatient.get(patient.id);
    const contact = contactMap[patient.id];
    const update = contact?.lastRegistrationUpdate as (Record<string, unknown> | undefined);

    const updatePossuiConvenio = update?.possuiConvenio === 'SIM' || Boolean(update?.convenioSelecionado && update.convenioSelecionado !== 'Nenhum');
    const updateConvenioNome = typeof update?.convenioSelecionado === 'string' && update.convenioSelecionado !== 'Nenhum' ? update.convenioSelecionado : undefined;

    const convenioNome =
      (typeof agreement?.convenio_nome === 'string' ? agreement.convenio_nome : undefined)
      || (lead?.possuiConvenio === 'SIM' && lead.convenioSelecionado && lead.convenioSelecionado !== 'Nenhum' ? lead.convenioSelecionado : undefined)
      || updateConvenioNome;

    const conveniado = Boolean(
      agreement?.convenio_ref
      || (lead?.possuiConvenio === 'SIM' && lead.convenioSelecionado && lead.convenioSelecionado !== 'Nenhum')
      || updatePossuiConvenio
    );

    return {
      id: patient.id,
      displayName: patient.displayName,
      status: patient.status,
      birthDate: patient.birthDate,
      phone: contactMap[patient.id]?.phone,
      email: contactMap[patient.id]?.email,
      primaryProfessionalId: patient.primaryProfessionalId,
      professionalName: patient.primaryProfessionalId
        ? professionalNames.get(patient.primaryProfessionalId)
        : undefined,
      nextAppointmentAt: next?.startsAt,
      completedSessions: own.filter((appointment) => appointment.status === 'completed').length,
      dropoutRegistered: openDropouts.has(patient.id),
      lastRegistrationUpdate: contactMap[patient.id]?.lastRegistrationUpdate,
      conveniado,
      convenioNome,
    };
  });
}

/**
 * Registra a saída a partir da carteira do próprio psicólogo.
 *
 * A gestão continua usando a tela de auditoria. Esta operação é
 * deliberadamente mais estreita: exige perfil profissional e paciente
 * atribuído ao ator, sem aceitar nome de paciente ou psicólogo vindos do
 * navegador.
 */
export async function registerPatientDropout(
  context: RequestContext,
  body: Record<string, unknown>
): Promise<AuditoriaDesistenciaRecord> {
  const isProfessional =
    context.actor.roles.includes('professional') &&
    !context.actor.roles.some((role) => role === 'owner' || role === 'admin');
  const professionalId = context.actor.professionalProfileId;
  if (!isProfessional || !professionalId) {
    throw new ApplicationError(
      'FORBIDDEN',
      'Somente o psicólogo responsável pode registrar a desistência nesta página.',
      403
    );
  }

  const patientId = String(body.patientId ?? '').trim();
  const reason = String(body.motivo ?? '').trim();
  if (!patientId || !motivoValido(reason)) {
    throw new ApplicationError('INVALID_INPUT', 'Paciente e motivo da desistência são obrigatórios.', 400);
  }

  const store = getApplicationStore();
  const patient = await store.identities.getPatient(context.actor.organizationId, patientId);
  if (!patient) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  assertStaffAuthorized(context.actor, 'patients.write', {
    organizationId: context.actor.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  if (!patient.assignedProfessionalIds.includes(professionalId)) {
    throw new ApplicationError('FORBIDDEN', 'Este paciente não pertence à sua carteira.', 403);
  }

  const snapshot = readSnapshot() ?? emptySnapshot();
  const recordId = `desistencia-${context.idempotencyKey}`;
  const repeatedCommand = (snapshot.auditoriaDesistencias ?? []).find((item) => item.id === recordId);
  if (repeatedCommand) return repeatedCommand;

  const alreadyOpen = (snapshot.auditoriaDesistencias ?? []).some(
    (item) =>
      item.pacienteId === patient.id &&
      !item.reengajado &&
      (!item.organizationId || item.organizationId === context.actor.organizationId)
  );
  if (alreadyOpen) {
    throw new ApplicationError('CONFLICT', 'Este paciente já possui uma desistência em acompanhamento.', 409);
  }

  const professional = await store.identities.getProfessional(
    context.actor.organizationId,
    professionalId
  );
  if (!professional) throw new ApplicationError('NOT_FOUND', 'Perfil profissional não encontrado.', 404);

  const description = String(body.descricaoDetalhada ?? '').trim().slice(0, 2000);
  const suggestedAction = String(body.acaoSugestao ?? '').trim().slice(0, 500);
  const now = new Date().toISOString();
  const dropout: AuditoriaDesistenciaRecord = {
    id: recordId,
    organizationId: context.actor.organizationId,
    pacienteId: patient.id,
    pacienteNome: patient.displayName,
    psicologoId: professionalId,
    psicologoNome: professional.displayName,
    motivo: reason,
    descricaoDetalhada: description || 'Saída do acompanhamento registrada pelo psicólogo responsável.',
    acaoSugestao: suggestedAction || 'Contato de reengajamento prioritário',
    dataDesistencia: now,
    reengajado: false,
    permitirTrocaPsicologo: Boolean(body.permitirTrocaPsicologo),
  };

  await store.identities.savePatient({ ...patient, status: 'discharged', updatedAt: now });
  await writeSnapshot({
    ...snapshot,
    auditoriaDesistencias: [dropout, ...(snapshot.auditoriaDesistencias ?? [])],
    savedAt: now,
  });

  // A triagem guarda o vínculo pelo `pacienteRef`. Marcar a saída aqui libera
  // imediatamente a capacidade sem atribuir o prontuário a outra pessoa.
  await getCaptureRepository().mutate((state) => {
    const next = recalcularPacientesAtivos({
      ...captureStateAsSnapshot(state),
      triagensPacientes: state.triagensPacientes.map((lead) =>
        lead.pacienteRef === patient.id ? { ...lead, status: 'DESISTENTE' as const } : lead
      ),
    });
    return {
      next: {
        triagensPacientes: next.triagensPacientes ?? [],
        cadastrosPsicologos: next.cadastrosPsicologos ?? [],
      },
      result: null,
    };
  });

  return dropout;
}

export async function createPatient(
  context: RequestContext,
  body: Record<string, unknown>
): Promise<PatientProfile> {
  assertStaffAuthorized(context.actor, 'patients.write', { organizationId: context.actor.organizationId });

  const displayName = String(body.displayName ?? body.nome ?? '').trim();
  if (!displayName) throw new ApplicationError('INVALID_INPUT', 'O nome do paciente é obrigatório.', 400);

  const professionalId = String(body.professionalId ?? context.actor.professionalProfileId ?? '').trim();
  if (!professionalId) {
    throw new ApplicationError('INVALID_INPUT', 'O paciente precisa de um profissional responsável.', 400);
  }
  if (context.actor.roles.includes('professional') && context.actor.professionalProfileId !== professionalId) {
    throw new ApplicationError('FORBIDDEN', 'Um psicólogo só pode cadastrar pacientes para o próprio perfil.', 403);
  }

  const fullRegistration = body.whatsapp ? validarSubmissaoTriagem(body) : undefined;
  if (fullRegistration && !fullRegistration.ok) {
    throw new ApplicationError('INVALID_INPUT', fullRegistration.erro, fullRegistration.status);
  }
  const registration = validatePatientRegistrationDetails(body);
  if (!registration.ok) {
    throw new ApplicationError('INVALID_INPUT', registration.error, 400);
  }

  const store = getApplicationStore();
  const id = String(body.id ?? '').trim() || `patient-${crypto.randomUUID()}`;

  // Cadastro repetido com o mesmo id devolve o que já existe em vez de
  // sobrescrever: a rota exige Idempotency-Key e precisa se comportar como tal.
  const existing = await store.identities.getPatient(context.actor.organizationId, id);
  if (existing) return existing;

  const patient = createPatientProfile({
    id,
    organizationId: context.actor.organizationId,
    userId: body.userId ? String(body.userId) : undefined,
    externalReference: body.externalReference ? String(body.externalReference) : undefined,
    displayName,
    birthDate: body.birthDate ? String(body.birthDate) : undefined,
    primaryProfessionalId: professionalId,
    assignedProfessionalIds: [professionalId],
    createdAt: String(body.createdAt ?? new Date().toISOString()),
  });

  await store.identities.savePatient(patient);

  const contacts = contactSource(store.identities);
  if (contacts) {
    await contacts.savePatientContact(patient.id, {
      phone: body.phone ? String(body.phone) : body.whatsapp ? String(body.whatsapp) : undefined,
      email: body.email ? String(body.email) : undefined,
      legalName: body.legalName ? String(body.legalName) : body.nome ? String(body.nome) : undefined,
      socialName: body.socialName ? String(body.socialName) : body.nomeSocial ? String(body.nomeSocial) : undefined,
      documento: body.cpf ? String(body.cpf).replace(/\D/g, '') : undefined,
      cep: registration.data.address.cep,
      logradouro: registration.data.address.logradouro,
      numero: registration.data.address.numero,
      complemento: registration.data.address.complemento,
      bairro: registration.data.address.bairro,
      cidade: registration.data.address.cidade,
      uf: registration.data.address.uf,
      emergencyContactName: registration.data.emergencyContactName,
      emergencyContactPhone: registration.data.emergencyContactPhone,
      registrationNotes: registration.data.registrationNotes,
    });
  }

  // O cadastro interno usa a mesma fonte complementar da vitrine. Ele já nasce
  // confirmado e ligado ao psicólogo da sessão, portanto não entra no rodízio
  // nem dispara aviso de "novo lead" para outro profissional.
  if (fullRegistration?.ok) {
    const data = fullRegistration.dados;
    const professional = await store.identities.getProfessional(context.actor.organizationId, professionalId);
    const now = new Date().toISOString();
    const leadId = `triagem-manual-${patient.id}`;
    await getCaptureRepository().mutate((state) => {
      if (state.triagensPacientes.some((lead) => lead.id === leadId || lead.pacienteRef === patient.id)) {
        return { next: state, result: null };
      }
      return {
        next: {
          ...state,
          triagensPacientes: [...state.triagensPacientes, {
            id: leadId,
            protocolo: `VM-MANUAL-${patient.id.slice(-8).toUpperCase()}`,
            nomePaciente: String(body.legalName ?? body.nome ?? displayName),
            telefone: data.telefone,
            dataNascimento: data.dataNascimento,
            email: data.email,
            cpf: data.cpf,
            cep: data.cep,
            logradouro: data.logradouro,
            numeroResidencia: data.numeroResidencia,
            complemento: data.complemento,
            bairro: data.bairro,
            cidade: data.cidade,
            estadoUf: data.estadoUf,
            possuiConvenio: data.possuiConvenio,
            convenioSelecionado: data.convenioSelecionado,
            origem: data.origem,
            turno: data.turno,
            servico: data.servico,
            servicoKey: data.servicoKey,
            modalidade: data.modalidade,
            paraQuemE: data.paraQuemE,
            opcaoAvaliacaoPsicologica: data.opcaoAvaliacaoPsicologica,
            genero: data.genero,
            generoOutro: data.generoOutro,
            especificarNecessidades: data.especificarNecessidades,
            necessidadesPaciente: data.necessidadesPaciente,
            necessidadesOutro: data.necessidadesOutro,
            status: 'CONTATO_CONFIRMADO' as const,
            psicologoAlocadoId: professionalId,
            psicologoNome: professional?.displayName,
            pacienteRef: patient.id,
            alocadoEm: now,
            confirmadoEm: now,
            slaExpirado: false,
            transbordos: 0,
            psicologosJaTentados: [professionalId],
            criadoEm: now,
          }],
        },
        result: null,
      };
    });
  }

  await persistApplicationState();
  return patient;
}

async function authorizedPatient(context: RequestContext, patientId: string) {
  const store = getApplicationStore();
  const patient = await store.identities.getPatient(context.actor.organizationId, patientId);
  if (!patient) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  assertStaffAuthorized(context.actor, 'patients.read', {
    organizationId: context.actor.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  return { store, patient };
}

export async function getPatientRegistration(
  context: RequestContext,
  patientId: string
): Promise<PatientRegistrationRecord> {
  const { store } = await authorizedPatient(context, patientId);
  const source = registrationSource(store.identities);
  if (!source) throw new ApplicationError('UNAVAILABLE', 'O cadastro completo exige a persistência MySQL.', 503);
  const registration = await source.getPatientRegistration(context.actor.organizationId, patientId);
  if (!registration) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  return registration;
}

export async function updatePatientRegistration(
  context: RequestContext,
  patientId: string,
  body: Record<string, unknown>
): Promise<PatientRegistrationRecord> {
  const { store, patient } = await authorizedPatient(context, patientId);
  assertStaffAuthorized(context.actor, 'patients.write', {
    organizationId: context.actor.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  const parsed = validatePatientRegistrationDetails(body);
  if (!parsed.ok) throw new ApplicationError('INVALID_INPUT', parsed.error, 400);
  const source = registrationSource(store.identities);
  if (!source) throw new ApplicationError('UNAVAILABLE', 'O cadastro completo exige a persistência MySQL.', 503);
  const updated = await source.updatePatientRegistration({
    organizationId: context.actor.organizationId,
    patientId,
    details: parsed.data,
    actorUserId: context.actor.userId,
    changedAt: new Date().toISOString(),
  });
  if (!updated) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  return updated;
}

export async function reassignPatient(
  context: RequestContext,
  body: Record<string, unknown>
): Promise<PatientProfile> {
  const id = String(body.id ?? '').trim();
  const professionalId = String(body.professionalId ?? '').trim();
  const reason = String(body.motivo ?? '').trim();
  if (!id || !professionalId || !reason) {
    throw new ApplicationError(
      'INVALID_INPUT',
      'Paciente, novo psicólogo e motivo da reatribuição são obrigatórios.',
      400
    );
  }

  const store = getApplicationStore();
  const patient = await store.identities.getPatient(context.actor.organizationId, id);
  if (!patient) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);
  assertStaffAuthorized(context.actor, 'patients.write', {
    organizationId: context.actor.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });

  const professional = await store.identities.getProfessional(context.actor.organizationId, professionalId);
  if (!professional || professional.status !== 'active') {
    throw new ApplicationError('INVALID_INPUT', 'O novo psicólogo não existe ou está inativo.', 400);
  }
  if (context.actor.roles.includes('professional') && context.actor.professionalProfileId !== professionalId) {
    throw new ApplicationError('FORBIDDEN', 'Um psicólogo não pode reatribuir o paciente a outro perfil.', 403);
  }

  const reassigned = await store.identities.reassignPatient({
    organizationId: context.actor.organizationId,
    patientId: id,
    professionalId,
    actorUserId: context.actor.userId,
    reason,
    changedAt: new Date().toISOString(),
  });
  if (!reassigned) throw new ApplicationError('NOT_FOUND', 'Paciente não encontrado.', 404);

  // O cadastro clínico usa `professionalId`; o rodízio usa o id do cadastro
  // público. Atualizar os dois evita que a capacidade continue debitada do
  // psicólogo anterior depois de uma troca feita pela gestão.
  const captureRepository = getCaptureRepository();
  await captureRepository.mutate((state) => {
    const target = state.cadastrosPsicologos.find(
      (psychologist) => psychologist.profissionalRef === professionalId
    );
    if (!target) return { next: state, result: null };
    const snapshot = recalcularPacientesAtivos({
      ...captureStateAsSnapshot(state),
      triagensPacientes: state.triagensPacientes.map((lead) =>
        lead.pacienteRef === id
          ? { ...lead, psicologoAlocadoId: target.id, psicologoNome: target.nomeSocial || target.nomeCompleto }
          : lead
      ),
    });
    return {
      next: {
        triagensPacientes: snapshot.triagensPacientes ?? [],
        cadastrosPsicologos: snapshot.cadastrosPsicologos ?? [],
      },
      result: null,
    };
  });

  await persistApplicationState();
  return reassigned;
}

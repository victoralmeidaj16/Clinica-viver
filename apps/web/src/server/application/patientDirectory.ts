import { assertStaffAuthorized, createPatientProfile, type PatientProfile } from '@thats-life/core';
import type { PatientContact, PatientContactCapable } from '@/server/persistence/mysql/identityRepository';
import type { RequestContext } from './context';
import { ApplicationError } from './http';
import { getApplicationStore, persistApplicationState } from './store';
import { captureStateAsSnapshot, getCaptureRepository } from '@/server/persistence/captureRepository';
import { recalcularPacientesAtivos } from './viverMaisRodizio';

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
}

function contactSource(identities: unknown): PatientContactCapable | null {
  const candidate = identities as Partial<PatientContactCapable>;
  return typeof candidate.listPatientContacts === 'function' ? (candidate as PatientContactCapable) : null;
}

export async function listPatientDirectory(context: RequestContext): Promise<readonly PatientDirectoryEntry[]> {
  assertStaffAuthorized(context.actor, 'patients.read', { organizationId: context.actor.organizationId });

  const store = getApplicationStore();
  const organizationId = context.actor.organizationId;
  const contacts = contactSource(store.identities);

  const [patients, appointments, contactMap] = await Promise.all([
    store.identities.listPatients(organizationId),
    store.appointments.list({ organizationId }),
    contacts ? contacts.listPatientContacts(organizationId) : Promise.resolve<Record<string, PatientContact>>({}),
  ]);

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
    };
  });
}

export async function createPatient(
  context: RequestContext,
  body: Record<string, unknown>
): Promise<PatientProfile> {
  assertStaffAuthorized(context.actor, 'patients.write', { organizationId: context.actor.organizationId });

  const displayName = String(body.displayName ?? '').trim();
  if (!displayName) throw new ApplicationError('INVALID_INPUT', 'O nome do paciente é obrigatório.', 400);

  const professionalId = String(body.professionalId ?? context.actor.professionalProfileId ?? '').trim();
  if (!professionalId) {
    throw new ApplicationError('INVALID_INPUT', 'O paciente precisa de um profissional responsável.', 400);
  }
  if (context.actor.roles.includes('professional') && context.actor.professionalProfileId !== professionalId) {
    throw new ApplicationError('FORBIDDEN', 'Um psicólogo só pode cadastrar pacientes para o próprio perfil.', 403);
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
      phone: body.phone ? String(body.phone) : undefined,
      email: body.email ? String(body.email) : undefined,
    });
  }

  await persistApplicationState();
  return patient;
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

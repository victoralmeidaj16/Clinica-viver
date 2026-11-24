import {
  authorizeStaff,
  type IdentityRepository,
  type PatientProfile,
  type StaffAccessContext,
} from '../identity';
import type { ClinicalTimelineRepository } from './ports';

/**
 * Autoria no prontuário depois do fim do vínculo (especificação final, § 8.05).
 *
 * O psicólogo consulta, complementa ou corrige os registros que ele próprio
 * fez enquanto atendia o paciente, mesmo depois da transferência ou da
 * inativação. O registro original nunca é alterado: complemento e correção são
 * novas entradas, datadas e restritas ao autor, o que preserva a versão
 * anterior. Conta como autoria apenas o prontuário (`clinical_record`); evento
 * de agenda não é registro clínico do profissional.
 */

export type ClinicalTimelineWriteAccess = 'vinculo_atual' | 'complemento_do_autor';

const PRONTUARIO = ['clinical_record'] as const;

/** Decide se o profissional grava no prontuário deste paciente, e em que condição. */
export async function authorizeClinicalTimelineWrite(
  timelines: ClinicalTimelineRepository,
  actor: StaffAccessContext,
  patient: PatientProfile
): Promise<ClinicalTimelineWriteAccess> {
  const vinculoAtual = authorizeStaff(actor, 'clinical_records.write', {
    organizationId: patient.organizationId,
    patientId: patient.id,
    assignedProfessionalIds: patient.assignedProfessionalIds,
  });
  if (vinculoAtual.allowed) return 'vinculo_atual';

  const professionalId = actor.professionalProfileId;
  if (vinculoAtual.reason !== 'professional_not_assigned' || !professionalId) {
    throw new Error(`Acesso negado: ${vinculoAtual.reason}.`);
  }
  const registros = await timelines.list({
    organizationId: patient.organizationId,
    patientId: patient.id,
    categories: PRONTUARIO,
  });
  if (!registros.some((entry) => entry.authorizedProfessionalIds.includes(professionalId))) {
    throw new Error(`Acesso negado: ${vinculoAtual.reason}.`);
  }
  return 'complemento_do_autor';
}

export interface FormerTimelinePatient {
  patientId: string;
  displayName: string;
}

/**
 * Pacientes que o profissional não atende mais, mas em cujo prontuário ele
 * registrou algo. Devolve só identificação e nome: o ex-responsável não
 * recebe os dados administrativos atuais do paciente (§ 6.09).
 */
export async function listFormerTimelinePatientsForStaff(
  dependencies: { timelines: ClinicalTimelineRepository; identities: IdentityRepository },
  actor: StaffAccessContext
): Promise<readonly FormerTimelinePatient[]> {
  const decisao = authorizeStaff(actor, 'clinical_records.read', { organizationId: actor.organizationId });
  if (!decisao.allowed) throw new Error(`Acesso negado: ${decisao.reason}.`);
  const professionalId = actor.professionalProfileId;
  if (!professionalId) return [];

  const patientIds = await dependencies.timelines.listPatientIdsAuthorizedFor({
    organizationId: actor.organizationId,
    professionalId,
    categories: PRONTUARIO,
  });
  const pacientes = await Promise.all(
    patientIds.map((patientId) => dependencies.identities.getPatient(actor.organizationId, patientId))
  );
  return pacientes
    .filter((patient): patient is PatientProfile =>
      Boolean(patient) && !patient!.assignedProfessionalIds.includes(professionalId))
    .map((patient) => ({ patientId: patient.id, displayName: patient.displayName }))
    .sort((first, second) => first.displayName.localeCompare(second.displayName, 'pt-BR'));
}

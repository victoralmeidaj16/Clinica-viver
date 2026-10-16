import type { PatientProfile } from '@thats-life/core';
import type { PatientContact } from '@/server/persistence/mysql/identityRepository';
import type { TriagemPacienteRecord } from './persistence';

/** Após a promoção, o cadastro editável é a fonte dos dados administrativos. */
export function managedPatientRegistration(
  patient: PatientProfile | undefined,
  contact: PatientContact | undefined,
  lead: TriagemPacienteRecord | undefined,
) {
  return {
    nome: contact?.socialName || contact?.legalName || patient?.displayName || lead?.nomeSocial || lead?.nomePaciente || 'Paciente',
    whatsapp: contact?.phone ?? lead?.telefone,
    email: contact?.email ?? lead?.email,
    cpf: contact?.documento ?? lead?.cpf,
    cep: contact?.cep ?? lead?.cep,
    numeroResidencia: contact?.numero ?? lead?.numeroResidencia,
  };
}

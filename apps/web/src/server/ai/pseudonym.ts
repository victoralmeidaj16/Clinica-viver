import { createHash } from 'node:crypto';

/**
 * Pseudonimização do paciente antes de qualquer chamada à IA.
 *
 * O provedor de IA recebe uma referência estável e opaca — nunca nome,
 * contato, documento ou data de nascimento. A referência é derivada da
 * organização e do paciente, então é consistente entre sessões do mesmo
 * paciente (permitindo continuidade clínica) e não colide entre clínicas.
 */
export function pseudonymizePatient(input: {
  organizationId: string;
  patientId: string;
}): string {
  const digest = createHash('sha256')
    .update(`${input.organizationId}:${input.patientId}`)
    .digest('hex')
    .slice(0, 12);
  return `paciente-${digest}`;
}

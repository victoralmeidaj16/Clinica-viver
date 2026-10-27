import { commandHeaders } from '@/lib/applicationApi';
import type { CusteioCiclo } from '@/lib/convenioBilling';
import type { ManagedPatient } from './managementTypes';
import type { SessionPricingCategory } from './patientSessionPricingView';

/** Mensagem do corpo de erro das rotas de gestão, que vem como texto ou `{ message }`. */
function failureMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: unknown } | null)?.error;
  if (typeof error === 'string') return error;
  const message = (error as { message?: unknown } | null | undefined)?.message;
  return typeof message === 'string' && message ? message : fallback;
}

/**
 * Encaminha o paciente a outro psicólogo. Triagem que ainda não virou paciente
 * (só `leadId`) passa pela rota da gestão; paciente já cadastrado, pela de pacientes.
 * Quem chama recarrega a própria fila depois.
 */
export async function reassignManagedPatient(
  patient: ManagedPatient,
  professionalId: string,
  reason: string,
): Promise<void> {
  const isLead = !patient.patientId && Boolean(patient.leadId);
  const response = await fetch(
    isLead ? '/api/application/gestao/pacientes' : '/api/application/patients',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(isLead ? commandHeaders() : {}) },
      body: JSON.stringify(isLead
        ? { leadId: patient.leadId, professionalId, motivo: reason }
        : { id: patient.patientId, professionalId, motivo: reason }),
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(failureMessage(body, `Falha ao encaminhar paciente (HTTP ${response.status}).`));
  }
}

/** Vincula (ou desvincula) o paciente a um convênio e define quem paga as sessões. */
export async function updatePatientConvenio(
  patientId: string,
  convenioId: string | null,
  custeadoPelaEmpresa: boolean | null,
  cota: { custeioCota: number | null; custeioCiclo: CusteioCiclo | null },
): Promise<void> {
  const response = await fetch(`/api/application/gestao/pacientes/${encodeURIComponent(patientId)}/convenio`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...commandHeaders() },
    body: JSON.stringify({ convenioId, custeadoPelaEmpresa, ...cota }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(failureMessage(body, `Falha ao atualizar convênio (HTTP ${response.status}).`));
  }
  if (Number(body?.data?.cobrancasPendentes ?? 0) > 0) {
    throw new Error('O vínculo foi salvo, mas algumas cobranças ainda precisam ser transferidas. Salve o vínculo novamente para tentar recuperá-las.');
  }
}

/** Atualiza somente a condição comercial futura do paciente. */
export async function updatePatientSessionPricing(
  patientId: string,
  input: { category: SessionPricingCategory; customAmountCents?: number },
): Promise<void> {
  const response = await fetch(`/api/application/gestao/pacientes/${encodeURIComponent(patientId)}/valor-sessao`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...commandHeaders() },
    body: JSON.stringify(input),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(failureMessage(body, `Falha ao atualizar valor da sessão (HTTP ${response.status}).`));
  }
}

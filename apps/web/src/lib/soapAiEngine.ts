import type { ReviewSession } from './postSessionApi';

/**
 * Modelo de apresentação do cockpit. O conteúdo clínico vem do rascunho
 * persistido no servidor; apenas o resumo sugerido ao paciente e os valores de
 * cobrança continuam simulados enquanto a IA e o provedor de pagamento não
 * estiverem integrados.
 */
export interface SoapView {
  sessionId: string;
  patientId: string;
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
  resumoPacienteSugerido: string;
  tarefasPacientes: string[];
  valorSessaoCentavos: number;
  vencimentoCobranca: string;
}

const DEMO_AMOUNT_CENTS = 25000;
const DUE_IN_DAYS = 5;

const SUGGESTED_SUMMARY =
  'Nesta sessão trabalhamos estratégias para lidar com a ansiedade na rotina de trabalho, reconhecer limites e fortalecer formas mais assertivas de comunicação.';

export function buildSoapView(session: ReviewSession): SoapView {
  const draft = session.draftContent;
  if (!draft) throw new Error('A sessão não possui rascunho clínico.');

  return {
    sessionId: session.sessionId,
    patientId: session.patientId,
    subjetivo: draft.subjective,
    objetivo: draft.objective,
    avaliacao: draft.assessment,
    plano: draft.plan,
    resumoPacienteSugerido: SUGGESTED_SUMMARY,
    tarefasPacientes: [...draft.extractedTasks],
    valorSessaoCentavos: DEMO_AMOUNT_CENTS,
    vencimentoCobranca: new Date(
      Date.now() + DUE_IN_DAYS * 24 * 60 * 60 * 1000
    ).toISOString(),
  };
}

export function formatCents(amountCents: number): string {
  return (amountCents / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

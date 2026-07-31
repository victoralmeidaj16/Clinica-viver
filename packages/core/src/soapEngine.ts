/**
 * AI SOAP Engine - Modelos de Prompts & Estruturação de Prontuários
 */

export interface SoapPromptInput {
  transcription: string;
  patientReference: string;
  previousContext?: string;
}

export function buildSoapPrompt(input: SoapPromptInput): string {
  const previousContext = input.previousContext
    ? `\nCONTEXTO CLÍNICO ANTERIOR AUTORIZADO:\n"""\n${input.previousContext}\n"""\n`
    : '';

  return `Você é um assistente de documentação clínica para psicologia.
Estruture um rascunho SOAP para revisão obrigatória da psicóloga ou do psicólogo responsável.

REFERÊNCIA PSEUDONIMIZADA DO PACIENTE: "${input.patientReference}"

DIRETRIZES:
- Subjetivo (S): Relatos emocionais e queixas do paciente.
- Objetivo (O): Registre apenas elementos audíveis ou explicitamente descritos na transcrição.
- Não invente contato visual, postura, linguagem corporal, sinais vitais ou outros dados não observáveis em áudio.
- Quando não houver evidência suficiente, escreva "não observável na fonte fornecida".
- Avaliação (A): Organize hipóteses para revisão profissional, sem apresentar inferências como fatos.
- Plano (P): Intervenções combinadas, encaminhamentos e tarefas passadas ao paciente.
- Não substitua julgamento clínico e não aprove o prontuário automaticamente.
${previousContext}

TRANSCRIÇÃO DA SESSÃO:
"""
${input.transcription}
"""`;
}

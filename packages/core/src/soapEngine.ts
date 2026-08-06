/**
 * AI SOAP Engine - Modelos de Prompts & Estruturação de Prontuários
 */

export interface SoapPromptInput {
  transcription: string; // Transcrição do áudio de síntese gravado pelo psicólogo pós-sessão
  patientReference: string;
  previousContext?: string;
}

export function buildSoapPrompt(input: SoapPromptInput): string {
  const previousContext = input.previousContext
    ? `\nCONTEXTO CLÍNICO ANTERIOR AUTORIZADO:\n"""\n${input.previousContext}\n"""\n`
    : '';

  return `Você é um assistente de documentação clínica para psicologia.
Estruture um rascunho SOAP a partir da síntese verbal gravada pelo psicólogo pós-sessão para revisão e edição do profissional.

REFERÊNCIA PSEUDONIMIZADA DO PACIENTE: "${input.patientReference}"

DIRETRIZES:
- Subjetivo (S): Relatos emocionais e queixas relatas na síntese.
- Objetivo (O): Registre observações clínicas e comportamento descritos pelo psicólogo.
- Avaliação (A): Organize hipóteses para revisão profissional.
- Plano (P): Intervenções combinadas, encaminhamentos e combinados para a próxima consulta.
- Todos os campos gerados são minutas e serão revisados e editados pelo psicólogo antes da assinatura.
${previousContext}

SÍNTESE DA SESSÃO GRAVADA PELO PSICÓLOGO (TRANSCRIÇÃO):
"""
${input.transcription}
"""`;
}

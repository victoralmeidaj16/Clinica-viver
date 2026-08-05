import Anthropic from '@anthropic-ai/sdk';

/**
 * Cliente da IA — exclusivamente server-side.
 *
 * A chave nunca atravessa a fronteira do servidor: nenhum componente do app
 * importa este módulo, e a variável não usa o prefixo `NEXT_PUBLIC_`.
 */

export const CLINICAL_MODEL = 'claude-opus-5';

/** Versão do prompt clínico, registrada na proveniência de cada rascunho. */
export const CLINICAL_PROMPT_VERSION = 'soap-v1.0';

export class AiNotConfiguredError extends Error {
  constructor() {
    super(
      'IA não configurada. Defina AI_PROVIDER_API_KEY no ambiente do servidor para gerar rascunhos e usar o copiloto.'
    );
    this.name = 'AiNotConfiguredError';
  }
}

let cached: Anthropic | null = null;

export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_PROVIDER_API_KEY?.trim());
}

export function getAiClient(): Anthropic {
  const apiKey = process.env.AI_PROVIDER_API_KEY?.trim();
  if (!apiKey) {
    throw new AiNotConfiguredError();
  }
  if (!cached) {
    cached = new Anthropic({ apiKey });
  }
  return cached;
}

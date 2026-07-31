import type { SoapClinicalContent } from './types';
import { normalizeSoapContent } from './validation';

/**
 * Serialização canônica da revisão SOAP. A ordem dos campos é fixa e as tarefas
 * são ordenadas para que o mesmo conteúdo produza sempre o mesmo hash,
 * independentemente da ordem em que o cockpit montou o objeto.
 */
export function canonicalizeSoapContent(content: SoapClinicalContent): string {
  const normalized = normalizeSoapContent(content);
  return JSON.stringify([
    normalized.subjective,
    normalized.objective,
    normalized.assessment,
    normalized.plan,
    [...normalized.extractedTasks].sort((first, second) =>
      first.localeCompare(second, 'pt-BR')
    ),
  ]);
}

/**
 * Hash SHA-256 do conteúdo aprovado. É a referência verificável usada pela
 * aprovação do prontuário e pela projeção na linha do tempo clínica: quem
 * consulta uma entrada pode recomputar o hash e provar que a evidência exibida
 * corresponde à revisão que o profissional aprovou.
 */
export async function computeSoapContentHash(
  content: SoapClinicalContent
): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalizeSoapContent(content));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

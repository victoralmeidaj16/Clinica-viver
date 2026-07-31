/**
 * Camada heurística de remoção de PII para revisão humana.
 * Não constitui, isoladamente, garantia de anonimização segundo a LGPD.
 */

export interface AnonymizationResult {
  textAnonymized: string;
  piiRemovedCount: number;
  piiTypesFound: string[];
}

export interface AnonymizationOptions {
  knownIdentifiers?: string[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function anonymizeClinicalNote(
  rawNote: string,
  options: AnonymizationOptions = {}
): AnonymizationResult {
  let cleaned = rawNote;
  const piiTypesFound = new Set<string>();
  let piiRemovedCount = 0;

  const replaceMatches = (pattern: RegExp, replacement: string, type: string) => {
    cleaned = cleaned.replace(pattern, () => {
      piiRemovedCount++;
      piiTypesFound.add(type);
      return replacement;
    });
  };

  replaceMatches(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REMOVIDO]', 'CPF');
  replaceMatches(
    /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
    '[EMAIL_OMITIDO]',
    'E-mail'
  );
  replaceMatches(
    /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?\d{4,5}[-\s]?\d{4}\b/g,
    '[TELEFONE_OMITIDO]',
    'Telefone'
  );

  for (const identifier of options.knownIdentifiers ?? []) {
    const normalizedIdentifier = identifier.trim();
    if (!normalizedIdentifier) continue;

    replaceMatches(
      new RegExp(escapeRegExp(normalizedIdentifier), 'gi'),
      '[IDENTIFICADOR_OMITIDO]',
      'Identificador informado'
    );
  }

  return {
    textAnonymized: cleaned,
    piiRemovedCount,
    piiTypesFound: Array.from(piiTypesFound),
  };
}

import type { GeneroProfissional } from '@thats-life/core';

export const GENDER_VALUES = [
  'MASCULINO',
  'FEMININO',
  'NAO_BINARIO',
  'OUTRO',
  'PREFIRO_NAO_INFORMAR',
] as const;
export type GenderValue = (typeof GENDER_VALUES)[number];

export function normalizeGender(value: unknown): GenderValue | null {
  const normalized = String(value ?? '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalized === 'PREFIRO NAO INFORMAR' || normalized === 'PREFIRO_NAO_INFORMAR' || normalized === 'NAO INFORMADO' || normalized === 'NAO_INFORMADO') {
    return 'PREFIRO_NAO_INFORMAR';
  }
  if (normalized === 'NAO BINARIO' || normalized === 'NAO_BINARIO') {
    return 'NAO_BINARIO';
  }
  return GENDER_VALUES.includes(normalized as GenderValue) ? (normalized as GenderValue) : null;
}

/**
 * O gênero do profissional reduzido ao que a preferência do paciente sabe
 * comparar — "prefiro uma psicóloga" só distingue duas respostas.
 *
 * Qualquer outra declaração vira `undefined`, e não um terceiro valor: quem
 * chama precisa decidir sabendo que não dá para afirmar que o pedido foi
 * atendido, em vez de comparar contra um rótulo que a pergunta não oferece.
 * Vale tanto para a vitrine, que usa isso para exibir, quanto para o rodízio,
 * que usa para indicar — daí morar aqui, e não em cada ponta.
 */
export function generoProfissional(genero: string | undefined): GeneroProfissional | undefined {
  const normalizado = normalizeGender(genero);
  return normalizado === 'MASCULINO' || normalizado === 'FEMININO' ? normalizado : undefined;
}

export function validateGender(value: unknown, other: unknown): { gender: GenderValue; other?: string } | null {
  const gender = normalizeGender(value);
  if (!gender) return null;
  if (gender !== 'OUTRO') return { gender };

  const description = String(other ?? '').trim();
  if (!description || description.length > 120) return null;
  return { gender, other: description };
}

export function formatGender(value: string | undefined, other?: string): string | undefined {
  if (!value) return undefined;
  const normalized = normalizeGender(value) ?? value;
  if (normalized === 'MASCULINO') return 'Masculino';
  if (normalized === 'FEMININO') return 'Feminino';
  if (normalized === 'NAO_BINARIO') return 'Não binário';
  if (normalized === 'OUTRO') return other ? `Outro — ${other}` : 'Outro';
  if (normalized === 'PREFIRO_NAO_INFORMAR') return 'Prefiro não informar';
  return value;
}

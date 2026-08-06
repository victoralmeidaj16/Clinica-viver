import 'server-only';

import { createHash } from 'node:crypto';

/**
 * Identificadores do MySQL da OCI derivados dos ids do domínio.
 *
 * As tabelas usam `CHAR(36)`, mas os agregados do core trabalham com ids
 * livres (`patient-1`, `org-demo`, `appointment-3`). A ponte entre os dois
 * precisa ser uma função, não um `randomUUID()`: a idempotência de comando
 * depende de a mesma chave produzir sempre a mesma linha. Portado de
 * `Sponteiro/apps/viver-mais-web/src/lib/oci/identidade.ts`.
 */
export function uuidDeterministico(chave: string): string {
  const hex = createHash('sha256').update(chave).digest('hex').slice(0, 32).split('');
  hex[12] = '5';
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const valor = hex.join('');
  return `${valor.slice(0, 8)}-${valor.slice(8, 12)}-${valor.slice(12, 16)}-${valor.slice(16, 20)}-${valor.slice(20)}`;
}

/**
 * Slug da instituição atendida por esta instalação.
 *
 * O padrão é o mesmo já gravado em `instituicoes` pelo 005_seed_profissionais:
 * `viver-mais-psicologia` deriva o id `66b591ea-00ae-52f0-8a78-4b654231ae12`.
 * Mudar este valor aponta a aplicação para outro tenant — não é preferência de
 * nome.
 */
export function organizationSlug(): string {
  return process.env.ORGANIZATION_SLUG?.trim() || 'viver-mais-psicologia';
}

/** `instituicoes.id`, presente em toda tabela do schema. */
export function instituicaoIdPadrao(): string {
  return uuidDeterministico(`instituicao:${organizationSlug()}`);
}

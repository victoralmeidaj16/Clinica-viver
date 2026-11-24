/**
 * Diferença entre o antes e o depois de uma intervenção administrativa
 * (especificação final, 13.02). Sem dependência de servidor.
 */

export interface CampoAlterado {
  campo: string;
  rotulo: string;
  anterior: string;
  novo: string;
}

export type ValorAuditavel = string | number | boolean | null | undefined | readonly string[];

const VAZIO = '—';

export function textoAuditavel(valor: ValorAuditavel): string {
  if (valor === null || valor === undefined || valor === '') return VAZIO;
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (Array.isArray(valor)) return valor.length ? valor.join(', ') : VAZIO;
  return String(valor);
}

/**
 * Compara campo a campo e devolve só o que mudou. `rotulos` define quais
 * campos entram e o nome que a Gestão lê; campos fora dele são ignorados.
 */
export function camposAlterados(
  antes: Readonly<Record<string, ValorAuditavel>>,
  depois: Readonly<Record<string, ValorAuditavel>>,
  rotulos: Readonly<Record<string, string>>
): CampoAlterado[] {
  const alterados: CampoAlterado[] = [];
  for (const [campo, rotulo] of Object.entries(rotulos)) {
    const anterior = textoAuditavel(antes[campo]);
    const novo = textoAuditavel(depois[campo]);
    if (anterior !== novo) alterados.push({ campo, rotulo, anterior, novo });
  }
  return alterados;
}

/** CPF entra na trilha só com os dois últimos dígitos do corpo e o verificador. */
export function mascararCpf(cpf: string | null | undefined): string {
  const digitos = (cpf ?? '').replace(/\D/g, '');
  if (digitos.length !== 11) return digitos ? '***' : VAZIO;
  return `***.***.*${digitos.slice(7, 9)}-${digitos.slice(9)}`;
}

export function reaisDeCentavos(centavos: number | null | undefined): string {
  if (centavos === null || centavos === undefined || !Number.isFinite(centavos)) return VAZIO;
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/ /g, ' ');
}

export const ROTULO_MODULO: Record<string, string> = {
  pacientes: 'Pacientes',
  psicologos: 'Psicólogos',
  fila: 'Fila e rodízio',
  agenda: 'Agenda',
  financeiro: 'Financeiro',
  convenios: 'Convênios',
  turmas: 'Turmas e cursos',
  configuracoes: 'Configurações e mensagens',
};

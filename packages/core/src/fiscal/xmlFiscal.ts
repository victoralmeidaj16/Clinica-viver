/**
 * Peças comuns aos documentos XML do Sistema Nacional NFS-e.
 *
 * A DPS e o pedido de registro de evento são documentos diferentes, com XSDs
 * diferentes, mas compartilham o mesmo vocabulário de campo: data com offset,
 * texto obrigatório com limite, código de largura fixa. Enquanto essas regras
 * viviam só dentro do gerador da DPS, o gerador do evento nasceria com uma
 * segunda implementação delas — e as duas divergiriam na primeira correção.
 */

export const somenteDigitos = (valor: string | number) => String(valor).replace(/\D/g, '');

export function escaparXml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Texto de campo obrigatório: sem caracteres de controle, sem espaço nas
 * pontas, dentro do limite do leiaute.
 */
export function textoObrigatorio(valor: string, campo: string, maximo: number, minimo = 1): string {
  const limpo = valor.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
  if (!limpo) throw new Error(`${campo} é obrigatório.`);
  if (limpo.length < minimo) throw new Error(`${campo} precisa de pelo menos ${minimo} caracteres.`);
  if (limpo.length > maximo) throw new Error(`${campo} excede o limite de ${maximo} caracteres.`);
  return limpo;
}

/** Código numérico de largura exata, como `cTribNac` e o código do município. */
export function codigo(valor: string, campo: string, tamanho: number): string {
  const limpo = somenteDigitos(valor);
  if (limpo.length !== tamanho) throw new Error(`${campo} deve ter ${tamanho} dígitos.`);
  return limpo;
}

/**
 * Data/hora com offset explícito, como `2026-08-17T14:30:00-03:00`.
 *
 * O offset não é decoração: sem ele a SEFIN interpreta o horário no fuso dela,
 * e um evento registrado à noite passa a valer no dia seguinte.
 */
export function dataHoraComOffset(valor: string, campo: string): string {
  const formatoValido =
    /^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d[+-](0\d|1[0-2]):00$/.test(valor);
  if (!formatoValido || Number.isNaN(Date.parse(valor))) {
    throw new Error(`${campo} deve ter offset, como AAAA-MM-DDThh:mm:ss-03:00.`);
  }
  return valor;
}

/**
 * Modelos de mensagem com campos dinâmicos (especificação final, 12.02).
 *
 * Um campo é escrito como `{{nome_do_campo}}`. A linha que contém apenas um
 * campo que ficou vazio é removida inteira: assim um trecho opcional (o
 * responsável de um menor, a modalidade da sessão) some sem deixar uma linha
 * em branco no meio da mensagem.
 *
 * Sem dependência de servidor: a mesma função monta o texto enviado e a
 * prévia do editor.
 */

const CAMPO = /\{\{\s*([a-z0-9_]+)\s*\}\}/g;
const LINHA_SO_COM_CAMPO = /^\s*\{\{\s*([a-z0-9_]+)\s*\}\}\s*$/;

export type ValoresDoModelo = Readonly<Record<string, string | undefined>>;

export function renderizarModelo(modelo: string, valores: ValoresDoModelo): string {
  const linhas: string[] = [];
  for (const linha of modelo.split('\n')) {
    const isolado = LINHA_SO_COM_CAMPO.exec(linha);
    if (isolado && !(valores[isolado[1]] ?? '').length) continue;
    linhas.push(linha.replace(CAMPO, (_, nome: string) => valores[nome] ?? ''));
  }
  return linhas.join('\n');
}

/** Campos citados no texto, na ordem da primeira ocorrência e sem repetição. */
export function camposDoModelo(modelo: string): string[] {
  const vistos = new Set<string>();
  for (const encontrado of modelo.matchAll(CAMPO)) vistos.add(encontrado[1]);
  return [...vistos];
}

export interface ProblemaDoModelo {
  tipo: 'campo_desconhecido' | 'campo_obrigatorio_ausente' | 'texto_vazio' | 'texto_longo' | 'chaves_soltas';
  mensagem: string;
}

/** Limite do texto editado: o WhatsApp aceita bem mais, mas o aviso não deve virar carta. */
export const TAMANHO_MAXIMO_MODELO = 4000;

/**
 * Confere o texto antes de gravar. Um campo desconhecido sairia literalmente
 * como `{{campo}}` para o paciente; um campo obrigatório ausente (o link de
 * decisão, por exemplo) deixaria o aviso sem a ação que ele existe para pedir.
 */
export function validarModelo(
  modelo: string,
  camposDisponiveis: readonly string[],
  camposObrigatorios: readonly string[] = []
): ProblemaDoModelo[] {
  const problemas: ProblemaDoModelo[] = [];
  if (!modelo.trim()) {
    problemas.push({ tipo: 'texto_vazio', mensagem: 'Escreva o texto da mensagem.' });
    return problemas;
  }
  if (modelo.length > TAMANHO_MAXIMO_MODELO) {
    problemas.push({ tipo: 'texto_longo', mensagem: `O texto passou de ${TAMANHO_MAXIMO_MODELO} caracteres.` });
  }
  const usados = camposDoModelo(modelo);
  for (const campo of usados) {
    if (!camposDisponiveis.includes(campo)) {
      problemas.push({ tipo: 'campo_desconhecido', mensagem: `O campo {{${campo}}} não existe para este aviso.` });
    }
  }
  for (const campo of camposObrigatorios) {
    if (!usados.includes(campo)) {
      problemas.push({ tipo: 'campo_obrigatorio_ausente', mensagem: `O campo {{${campo}}} é obrigatório neste aviso.` });
    }
  }
  const semCampos = modelo.replace(CAMPO, '');
  if (semCampos.includes('{{') || semCampos.includes('}}')) {
    problemas.push({ tipo: 'chaves_soltas', mensagem: 'Há chaves {{ }} incompletas ou com nome inválido (use letras minúsculas, números e _).' });
  }
  return problemas;
}

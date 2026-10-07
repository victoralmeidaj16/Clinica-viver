export interface ParteTexto { texto: string; estilo?: 'negrito' | 'italico' }

/**
 * Quebra `**negrito**` e `*itálico*` em partes, para o conteúdo da Ajuda ficar
 * em texto puro — sem `dangerouslySetInnerHTML`.
 */
export function partesTexto(texto: string): ParteTexto[] {
  const partes: ParteTexto[] = [];
  // Itálico só abre e fecha colado ao texto: um `*` solto ("campos com * são
  // obrigatórios") continua sendo asterisco.
  const marcas = /\*\*(.+?)\*\*|\*(?=\S)([^*]*?\S)\*/g;
  let inicio = 0;
  for (const achado of texto.matchAll(marcas)) {
    const posicao = achado.index ?? 0;
    if (posicao > inicio) partes.push({ texto: texto.slice(inicio, posicao) });
    partes.push(achado[1] !== undefined
      ? { texto: achado[1], estilo: 'negrito' }
      : { texto: achado[2], estilo: 'italico' });
    inicio = posicao + achado[0].length;
  }
  if (inicio < texto.length) partes.push({ texto: texto.slice(inicio) });
  return partes;
}

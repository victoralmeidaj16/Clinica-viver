export type PublicoVitrine =
  | 'Individual'
  | 'Infantil'
  | 'Adolescente'
  | 'Casal'
  | 'Família'
  | 'Outro';

const ALIASES_PUBLICO: Readonly<Record<string, string>> = {
  homem: 'homem',
  homens: 'homem',
  mulher: 'mulher',
  mulheres: 'mulher',
  idoso: 'idoso',
  idosos: 'idoso',
  idosa: 'idoso',
  idosas: 'idoso',
  crianca: 'crianca',
  criancas: 'crianca',
  infantil: 'crianca',
  adolescente: 'adolescente',
  adolescentes: 'adolescente',
  casal: 'casal',
  casais: 'casal',
  familia: 'familia',
  familias: 'familia',
  grupo: 'grupo',
  grupos: 'grupo',
  individual: 'individual',
};

export function normalizarPublicoAlvo(valor: string): string {
  const normalizado = valor
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (normalizado.startsWith('outro')) return 'outro';
  return ALIASES_PUBLICO[normalizado] ?? normalizado;
}

export function publicosCompativeisComSolicitacao(valor: string): readonly string[] {
  const solicitado = normalizarPublicoAlvo(valor);

  if (solicitado === 'individual') return ['homem', 'mulher', 'idoso'];
  return [solicitado];
}

export function publicoAlvoCompativel(
  publicos: readonly string[] | undefined,
  solicitado: string | undefined,
): boolean {
  if (!solicitado?.trim() || !publicos?.length) return true;

  const permitidos = new Set(publicosCompativeisComSolicitacao(solicitado));
  return publicos.some((publico) => permitidos.has(normalizarPublicoAlvo(publico)));
}

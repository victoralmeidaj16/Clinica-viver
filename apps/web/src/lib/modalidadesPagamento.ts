/**
 * As duas modalidades de sessão que a clínica cobra, e seus preços.
 *
 * Cada uma tem o próprio link permanente (`/pagar/<psicologo>/<modalidade>`),
 * então o valor deixa de ser uma escolha do paciente e passa a ser uma
 * propriedade do endereço: quem manda o link já decidiu o que está cobrando.
 *
 * Esta tabela é a única fonte do preço. A tela usa para exibir e a rota de
 * cobrança usa para calcular — o valor que chega do navegador é ignorado, senão
 * bastaria abrir o inspetor para pagar uma sessão por um real.
 */

export type ModalidadePagamentoSlug = 'social' | 'particular';

export interface ModalidadePagamento {
  slug: ModalidadePagamentoSlug;
  rotulo: string;
  descricao: string;
  valorCentavos: number;
}

export const MODALIDADES_PAGAMENTO: readonly ModalidadePagamento[] = [
  {
    slug: 'social',
    rotulo: 'Sessão Social',
    descricao: 'Valor social da clínica escola',
    valorCentavos: 7500,
  },
  {
    slug: 'particular',
    rotulo: 'Sessão Particular',
    descricao: 'Atendimento particular',
    valorCentavos: 13000,
  },
];

export function modalidadePorSlug(slug: string | undefined): ModalidadePagamento | null {
  const normalizado = slug?.trim().toLocaleLowerCase('pt-BR');
  return MODALIDADES_PAGAMENTO.find((modalidade) => modalidade.slug === normalizado) ?? null;
}

export function reaisDeCentavos(centavos: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);
}

/**
 * Nome legível a partir do slug do psicólogo.
 *
 * Continua sendo uma dedução do endereço enquanto o cadastro não é consultado
 * aqui — mas o título grafado errado numa tela de pagamento derruba a confiança
 * de quem vai pagar, então isto é o primeiro ponto a trocar por uma leitura do
 * cadastro real.
 */
export function nomeDoSlug(slug: string): string {
  if (!slug) return 'Profissional Viver Mais';

  const formatado = slug
    .split('-')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toLocaleUpperCase('pt-BR') + parte.slice(1))
    .join(' ');

  return formatado.startsWith('Dr') || formatado.startsWith('Psi') ? formatado : `Dr(a). ${formatado}`;
}

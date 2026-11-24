import { DEMANDAS_PADRAO } from './demandasPadrao';

/**
 * Demandas clínicas administradas pela Gestão (especificação final, 3.4).
 *
 * A demanda é gravada pelo nome no cadastro do psicólogo e no pedido do
 * paciente, e é pelo nome que o rodízio compara os dois. Por isso:
 *  - renomear troca o nome também nos cadastros e pedidos (ver o serviço), e
 *    o nome anterior fica guardado em `nomesAnteriores`;
 *  - remover desativa: some das listas de escolha, mas quem já marcou
 *    continua com ela e a comparação continua valendo.
 */

export interface DemandaClinica {
  nome: string;
  ativo: boolean;
  nomesAnteriores: readonly string[];
}

function normalizar(nome: string): string {
  return nome.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ');
}

export function lerCatalogoDemandas(valor: unknown): DemandaClinica[] {
  if (!Array.isArray(valor) || !valor.length) {
    return DEMANDAS_PADRAO.map((nome) => ({ nome, ativo: true, nomesAnteriores: [] }));
  }
  return valor.flatMap((item): DemandaClinica[] => {
    if (!item || typeof item !== 'object' || typeof (item as DemandaClinica).nome !== 'string') return [];
    const demanda = item as Partial<DemandaClinica>;
    return [{
      nome: demanda.nome!.trim(),
      ativo: demanda.ativo !== false,
      nomesAnteriores: Array.isArray(demanda.nomesAnteriores)
        ? demanda.nomesAnteriores.filter((anterior): anterior is string => typeof anterior === 'string')
        : [],
    }];
  });
}

export function demandasAtivas(catalogo: readonly DemandaClinica[]): string[] {
  return catalogo.filter((demanda) => demanda.ativo).map((demanda) => demanda.nome);
}

export type OperacaoDemanda =
  | { acao: 'ADICIONAR'; nome: string }
  | { acao: 'RENOMEAR'; nome: string; novoNome: string }
  | { acao: 'DESATIVAR' | 'REATIVAR'; nome: string };

export type ResultadoDemanda =
  | { ok: true; catalogo: DemandaClinica[]; renomeada?: { de: string; para: string } }
  | { ok: false; erro: string };

function nomeLimpo(valor: unknown): string | undefined {
  if (typeof valor !== 'string') return undefined;
  const limpo = valor.trim().replace(/\s+/g, ' ').slice(0, 120);
  return limpo.length >= 3 ? limpo : undefined;
}

export function aplicarOperacaoDemanda(catalogo: readonly DemandaClinica[], corpo: Record<string, unknown>): ResultadoDemanda {
  const nome = nomeLimpo(corpo.nome);
  if (!nome) return { ok: false, erro: 'Informe o nome da demanda (pelo menos 3 caracteres).' };
  const existe = (alvo: string, ignorar?: string) => catalogo.some((demanda) =>
    demanda.nome !== ignorar && normalizar(demanda.nome) === normalizar(alvo));

  if (corpo.acao === 'ADICIONAR') {
    if (existe(nome)) return { ok: false, erro: 'Já existe uma demanda com esse nome.' };
    return { ok: true, catalogo: [...catalogo, { nome, ativo: true, nomesAnteriores: [] }] };
  }

  const atual = catalogo.find((demanda) => demanda.nome === nome);
  if (!atual) return { ok: false, erro: 'Demanda não encontrada.' };

  if (corpo.acao === 'RENOMEAR') {
    const novoNome = nomeLimpo(corpo.novoNome);
    if (!novoNome) return { ok: false, erro: 'Informe o novo nome (pelo menos 3 caracteres).' };
    if (novoNome === atual.nome) return { ok: false, erro: 'O novo nome é igual ao atual.' };
    if (existe(novoNome, atual.nome)) return { ok: false, erro: 'Já existe uma demanda com esse nome.' };
    return {
      ok: true,
      catalogo: catalogo.map((demanda) => demanda === atual
        ? { ...demanda, nome: novoNome, nomesAnteriores: [...demanda.nomesAnteriores, demanda.nome] }
        : demanda),
      renomeada: { de: atual.nome, para: novoNome },
    };
  }
  if (corpo.acao === 'DESATIVAR' || corpo.acao === 'REATIVAR') {
    const ativo = corpo.acao === 'REATIVAR';
    if (atual.ativo === ativo) return { ok: false, erro: ativo ? 'A demanda já está ativa.' : 'A demanda já está removida.' };
    return { ok: true, catalogo: catalogo.map((demanda) => (demanda === atual ? { ...demanda, ativo } : demanda)) };
  }
  return { ok: false, erro: 'Ação desconhecida.' };
}

/** Troca um nome por outro numa lista gravada, sem duplicar. */
export function renomearNaLista(lista: readonly string[] | undefined, de: string, para: string): string[] | undefined {
  if (!lista?.includes(de)) return lista ? [...lista] : lista;
  return [...new Set(lista.map((item) => (item === de ? para : item)))];
}

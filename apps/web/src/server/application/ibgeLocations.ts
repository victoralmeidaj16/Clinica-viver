import 'server-only';

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
export const IBGE_CACHE_SECONDS = 60 * 60 * 24 * 7;

export interface IbgeEstado {
  id: number;
  sigla: string;
  nome: string;
}

export interface IbgeMunicipio {
  id: number;
  nome: string;
}

async function consultarIbge<T>(path: string): Promise<T> {
  const response = await fetch(`${IBGE_BASE}${path}`, {
    next: { revalidate: IBGE_CACHE_SECONDS },
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error(`IBGE HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function listarEstadosIbge(): Promise<IbgeEstado[]> {
  return consultarIbge<IbgeEstado[]>('/estados?orderBy=nome');
}

export function listarMunicipiosIbge(uf: string): Promise<IbgeMunicipio[]> {
  return consultarIbge<IbgeMunicipio[]>(`/estados/${encodeURIComponent(uf)}/municipios?orderBy=nome`);
}

const normalizarNome = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

export async function municipioPertenceAoEstado(uf: string, cidade: string): Promise<boolean> {
  const procurada = normalizarNome(cidade);
  const municipios = await listarMunicipiosIbge(uf);
  return municipios.some((municipio) => normalizarNome(municipio.nome) === procurada);
}

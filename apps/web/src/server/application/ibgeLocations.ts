import 'server-only';

import { Agent, get } from 'node:https';
import { rootCertificates } from 'node:tls';
import { SECTIGO_DV_R36_INTERMEDIARIO } from './ibgeCertificado';

const IBGE_BASE = 'https://servicodados.ibge.gov.br/api/v1/localidades';
export const IBGE_CACHE_SECONDS = 60 * 60 * 24 * 7;
const IBGE_TIMEOUT_MS = 7000;

// Raízes padrão + o intermediário que o IBGE não envia. Ver `ibgeCertificado.ts`.
const agenteIbge = new Agent({
  keepAlive: true,
  ca: [...rootCertificates, SECTIGO_DV_R36_INTERMEDIARIO],
});

// Sem o `fetch` do Next não há mais o cache de `revalidate`; estados e
// municípios quase nunca mudam, então guardar em memória pelo mesmo prazo
// evita uma ida ao IBGE a cada abertura do formulário.
const cache = new Map<string, { expiraEm: number; valor: Promise<unknown> }>();

function buscarJson(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requisicao = get(url, { agent: agenteIbge, timeout: IBGE_TIMEOUT_MS }, (response) => {
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`IBGE HTTP ${response.statusCode}`));
        return;
      }
      let corpo = '';
      response.setEncoding('utf8');
      response.on('data', (parte: string) => { corpo += parte; });
      response.on('end', () => {
        try {
          resolve(JSON.parse(corpo));
        } catch (erro) {
          reject(erro);
        }
      });
      response.on('error', reject);
    });
    requisicao.on('timeout', () => requisicao.destroy(new Error('IBGE: tempo esgotado')));
    requisicao.on('error', reject);
  });
}

export interface IbgeEstado {
  id: number;
  sigla: string;
  nome: string;
}

export interface IbgeMunicipio {
  id: number;
  nome: string;
}

function consultarIbge<T>(path: string): Promise<T> {
  const agora = Date.now();
  const guardado = cache.get(path);
  if (guardado && guardado.expiraEm > agora) return guardado.valor as Promise<T>;

  const valor = buscarJson(`${IBGE_BASE}${path}`);
  cache.set(path, { expiraEm: agora + IBGE_CACHE_SECONDS * 1000, valor });
  // Falha não fica em cache: a próxima abertura do formulário tenta de novo.
  valor.catch(() => {
    if (cache.get(path)?.valor === valor) cache.delete(path);
  });
  return valor as Promise<T>;
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

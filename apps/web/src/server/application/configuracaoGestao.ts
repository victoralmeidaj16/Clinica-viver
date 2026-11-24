import 'server-only';

import { normalizarPrazoOferta, prazoOfertaValido, PRAZO_OFERTA_PADRAO_HORAS } from '@/lib/prazoOferta';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import {
  CHAVE_PRAZO_OFERTA,
  configuracoesDisponiveis,
  gravarConfiguracao,
  lerConfiguracao,
  type AlteracaoConfiguracao,
} from '@/server/persistence/mysql/configuracaoGestaoRepository';
import type { AutorDaSessao } from './autorGestao';
import { ApplicationError } from './http';
import { emptySnapshot, readSnapshot, writeSnapshot, type ConfiguracaoGestaoRecord } from './persistence';

/**
 * Configurações da Gestão por chave (especificação final, 13.01 e 13.02):
 * prazo da oferta, catálogo de cursos, demandas clínicas, prazo de saída das
 * turmas e avisos. No MySQL ficam em `clinica_configuracoes_gestao` (migration
 * 087), com valor anterior, valor novo, autor e data de cada mudança; sem
 * MySQL, no snapshot em arquivo, com o mesmo histórico.
 */

export interface ConfiguracaoComHistorico<T> {
  /** `undefined` quando nunca foi gravada: vale o padrão do chamador. */
  valor: T | undefined;
  atualizadoEm?: string;
  atualizadoPorNome?: string;
  historico: readonly AlteracaoConfiguracao[];
  /** `false` quando a migration 087 ainda não chegou ao banco. */
  editavel: boolean;
}

/** Organização da instalação, para leituras sem sessão (vitrine, rodízio). */
export function organizacaoPadrao(): string {
  return process.env.ORGANIZATION_ID?.trim() || process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || 'org-viver-mais';
}

function doArquivo(organizationId: string, chave: string): ConfiguracaoGestaoRecord | undefined {
  return (readSnapshot()?.configuracoesGestao ?? []).find((item) => item.chave === `${organizationId}:${chave}`);
}

export async function lerConfiguracaoGestao<T>(organizationId: string, chave: string): Promise<ConfiguracaoComHistorico<T>> {
  if (isMysqlConfigured()) {
    const pool = getMysqlPool();
    const editavel = await configuracoesDisponiveis(pool);
    const lida = editavel ? await lerConfiguracao(pool, organizationId, chave).catch(() => null) : null;
    return {
      valor: lida?.valor as T | undefined,
      atualizadoEm: lida?.atualizadoEm,
      atualizadoPorNome: lida?.atualizadoPorNome,
      historico: lida?.historico ?? [],
      editavel,
    };
  }
  const registro = doArquivo(organizationId, chave);
  return {
    valor: registro?.valor as T | undefined,
    atualizadoEm: registro?.atualizadoEm,
    atualizadoPorNome: registro?.atualizadoPorNome,
    historico: [...(registro?.historico ?? [])].reverse(),
    editavel: true,
  };
}

/** Grava o valor novo e uma linha de histórico com o anterior. */
export async function gravarConfiguracaoGestao(
  organizationId: string,
  chave: string,
  valor: unknown,
  autor: AutorDaSessao,
  agora: Date = new Date(),
  valorPadraoAnterior: unknown = null
): Promise<void> {
  if (isMysqlConfigured()) {
    const pool = getMysqlPool();
    if (!(await configuracoesDisponiveis(pool))) {
      throw new ApplicationError('UNAVAILABLE', 'As configurações da Gestão requerem a migration 087_configuracoes_gestao.sql.', 503);
    }
    await gravarConfiguracao(pool, organizationId, chave, valor, autor, agora);
    return;
  }
  const snapshot = readSnapshot() ?? emptySnapshot();
  const id = `${organizationId}:${chave}`;
  const anterior = (snapshot.configuracoesGestao ?? []).find((item) => item.chave === id);
  const registro: ConfiguracaoGestaoRecord = {
    chave: id,
    valor,
    atualizadoEm: agora.toISOString(),
    atualizadoPorUsuarioRef: autor.usuarioRef,
    atualizadoPorNome: autor.nome,
    historico: [
      ...(anterior?.historico ?? []),
      {
        valorAnterior: anterior?.valor ?? valorPadraoAnterior,
        valorNovo: valor,
        alteradoEm: agora.toISOString(),
        alteradoPorUsuarioRef: autor.usuarioRef,
        alteradoPorNome: autor.nome,
      },
    ],
  };
  await writeSnapshot({
    ...snapshot,
    savedAt: agora.toISOString(),
    configuracoesGestao: [...(snapshot.configuracoesGestao ?? []).filter((item) => item.chave !== id), registro],
  });
}

/** Prazo da oferta como a tela da Gestão o mostra (5.02 e 13.02). */
export interface ConfiguracaoPrazoOferta {
  prazoOfertaHoras: number;
  /** Nunca foi alterado: vale o padrão de 24 horas. */
  padrao: boolean;
  atualizadoEm?: string;
  atualizadoPorNome?: string;
  historico: readonly AlteracaoConfiguracao[];
  editavel: boolean;
}

export async function obterPrazoOferta(organizationId: string): Promise<ConfiguracaoPrazoOferta> {
  const lida = await lerConfiguracaoGestao<number>(organizationId, CHAVE_PRAZO_OFERTA);
  return {
    prazoOfertaHoras: normalizarPrazoOferta(lida.valor),
    padrao: lida.valor === undefined,
    atualizadoEm: lida.atualizadoEm,
    atualizadoPorNome: lida.atualizadoPorNome,
    historico: lida.historico,
    editavel: lida.editavel,
  };
}

/**
 * Altera o prazo das próximas ofertas. As que já foram enviadas mantêm o
 * prazo com que nasceram — o paciente e o psicólogo receberam aquele número.
 */
export async function alterarPrazoOferta(
  organizationId: string,
  valor: unknown,
  autor: AutorDaSessao,
  agora: Date = new Date()
): Promise<ConfiguracaoPrazoOferta> {
  const horas = prazoOfertaValido(valor);
  if (horas === null) {
    throw new ApplicationError('INVALID_INPUT', 'Informe um prazo em horas inteiras, de 1 a 168 (uma semana).', 400);
  }
  await gravarConfiguracaoGestao(organizationId, CHAVE_PRAZO_OFERTA, horas, autor, agora, PRAZO_OFERTA_PADRAO_HORAS);
  return obterPrazoOferta(organizationId);
}

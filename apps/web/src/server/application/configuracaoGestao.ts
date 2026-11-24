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

/** Prazo da oferta como a tela da Gestão o mostra (5.02 e 13.02). */
export interface ConfiguracaoPrazoOferta {
  prazoOfertaHoras: number;
  /** Nunca foi alterado: vale o padrão de 24 horas. */
  padrao: boolean;
  atualizadoEm?: string;
  atualizadoPorNome?: string;
  historico: readonly AlteracaoConfiguracao[];
  /** `false` quando a migration 087 ainda não chegou ao banco. */
  editavel: boolean;
}

function doArquivo(organizationId: string): ConfiguracaoGestaoRecord | undefined {
  return (readSnapshot()?.configuracoesGestao ?? [])
    .find((item) => item.chave === `${organizationId}:${CHAVE_PRAZO_OFERTA}`);
}

export async function obterPrazoOferta(organizationId: string): Promise<ConfiguracaoPrazoOferta> {
  if (isMysqlConfigured()) {
    const pool = getMysqlPool();
    const editavel = await configuracoesDisponiveis(pool);
    const lida = editavel ? await lerConfiguracao(pool, organizationId, CHAVE_PRAZO_OFERTA) : null;
    return {
      prazoOfertaHoras: normalizarPrazoOferta(lida?.valor),
      padrao: !lida,
      atualizadoEm: lida?.atualizadoEm,
      atualizadoPorNome: lida?.atualizadoPorNome,
      historico: lida?.historico ?? [],
      editavel,
    };
  }
  const registro = doArquivo(organizationId);
  return {
    prazoOfertaHoras: normalizarPrazoOferta(registro?.valor),
    padrao: !registro,
    atualizadoEm: registro?.atualizadoEm,
    atualizadoPorNome: registro?.atualizadoPorNome,
    historico: [...(registro?.historico ?? [])].reverse(),
    editavel: true,
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
  if (isMysqlConfigured()) {
    const pool = getMysqlPool();
    if (!(await configuracoesDisponiveis(pool))) {
      throw new ApplicationError('UNAVAILABLE', 'A configuração de prazos requer a migration 087_configuracoes_gestao.sql.', 503);
    }
    await gravarConfiguracao(pool, organizationId, CHAVE_PRAZO_OFERTA, horas, autor, agora);
    return obterPrazoOferta(organizationId);
  }

  const snapshot = readSnapshot() ?? emptySnapshot();
  const chave = `${organizationId}:${CHAVE_PRAZO_OFERTA}`;
  const anterior = (snapshot.configuracoesGestao ?? []).find((item) => item.chave === chave);
  const registro: ConfiguracaoGestaoRecord = {
    chave,
    valor: horas,
    atualizadoEm: agora.toISOString(),
    atualizadoPorUsuarioRef: autor.usuarioRef,
    atualizadoPorNome: autor.nome,
    historico: [
      ...(anterior?.historico ?? []),
      {
        valorAnterior: anterior?.valor ?? PRAZO_OFERTA_PADRAO_HORAS,
        valorNovo: horas,
        alteradoEm: agora.toISOString(),
        alteradoPorUsuarioRef: autor.usuarioRef,
        alteradoPorNome: autor.nome,
      },
    ],
  };
  await writeSnapshot({
    ...snapshot,
    savedAt: agora.toISOString(),
    configuracoesGestao: [...(snapshot.configuracoesGestao ?? []).filter((item) => item.chave !== chave), registro],
  });
  return obterPrazoOferta(organizationId);
}

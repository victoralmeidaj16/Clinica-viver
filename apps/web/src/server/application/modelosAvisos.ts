import 'server-only';

import {
  avisoDoCatalogo,
  CATALOGO_AVISOS,
  normalizarConfiguracao,
  PREFIXO_CHAVE_MODELO,
  type AvisoDoCatalogo,
  type CanalAviso,
  type ConfiguracaoDoAviso,
} from '@/lib/avisos/catalogo';
import { renderizarModelo, validarModelo, type ValoresDoModelo } from '@/lib/avisos/modelo';
import type { AlteracaoConfiguracao } from '@/server/persistence/mysql/configuracaoGestaoRepository';
import type { AutorDaSessao } from './autorGestao';
import { gravarConfiguracaoGestao, lerConfiguracaoGestao, organizacaoPadrao } from './configuracaoGestao';
import { ApplicationError } from './http';

/**
 * Modelos editáveis dos avisos (especificação final, 12.01–12.02).
 *
 * Cada aviso guarda, na configuração da Gestão, o texto próprio (ou `null`
 * para o padrão), o canal, a ativação dos complementares e o número da versão.
 * O histórico da configuração é o histórico de versões: cada linha tem o
 * texto anterior, o novo, quem mudou e quando (13.02).
 */

export interface ModeloVigente {
  configuracao: ConfiguracaoDoAviso;
  /** Texto que sai, já com os campos preenchidos. */
  texto: string;
}

const CACHE_MS = 30_000;
const cache = new Map<string, { lidoEm: number; configuracao: ConfiguracaoDoAviso }>();

/** Para testes e para a tela, que precisa ver a gravação na hora. */
export function limparCacheDosModelos(): void {
  cache.clear();
}

async function configuracaoDoAviso(aviso: AvisoDoCatalogo, organizationId: string): Promise<ConfiguracaoDoAviso> {
  const chave = `${organizationId}:${aviso.finalidade}`;
  const guardada = cache.get(chave);
  if (guardada && Date.now() - guardada.lidoEm < CACHE_MS) return guardada.configuracao;
  const lida = await lerConfiguracaoGestao<unknown>(organizationId, PREFIXO_CHAVE_MODELO + aviso.finalidade);
  const configuracao = normalizarConfiguracao(aviso, lida.valor);
  cache.set(chave, { lidoEm: Date.now(), configuracao });
  return configuracao;
}

/**
 * Texto e canal de um aviso no momento do envio.
 *
 * Nunca lança: uma falha ao ler a configuração não pode impedir o aviso de
 * sair, então vale o padrão. `textoPadrao` é o que o chamador montou com o
 * mesmo modelo padrão do catálogo.
 */
export async function modeloVigente(
  finalidade: string,
  valores: ValoresDoModelo | undefined,
  textoPadrao: string,
  organizationId: string = organizacaoPadrao()
): Promise<ModeloVigente | null> {
  const aviso = avisoDoCatalogo(finalidade);
  if (!aviso) return null;
  try {
    const configuracao = await configuracaoDoAviso(aviso, organizationId);
    const texto = configuracao.texto && valores ? renderizarModelo(configuracao.texto, valores) : textoPadrao;
    // Versão própria sem os campos do chamador cai no padrão — e é o padrão
    // que fica registrado como enviado.
    return {
      configuracao: configuracao.texto && valores ? configuracao : { ...configuracao, versao: 0 },
      texto,
    };
  } catch (erro) {
    console.warn(`[avisos] Modelo de "${finalidade}" indisponível; vale o texto padrão.`, erro instanceof Error ? erro.message : '');
    return { configuracao: normalizarConfiguracao(aviso, undefined), texto: textoPadrao };
  }
}

/** Canal configurado, para os envios que não passam pelo WhatsApp (e-mail). */
export async function canalDoAviso(finalidade: string, organizationId: string = organizacaoPadrao()): Promise<CanalAviso | null> {
  const aviso = avisoDoCatalogo(finalidade);
  if (!aviso) return null;
  try {
    return (await configuracaoDoAviso(aviso, organizationId)).canal;
  } catch {
    return aviso.canalPadrao;
  }
}

/** Complementar desligado não sai; essencial sai sempre. */
export async function avisoAtivo(finalidade: string, organizationId: string = organizacaoPadrao()): Promise<boolean> {
  const aviso = avisoDoCatalogo(finalidade);
  if (!aviso) return true;
  if (aviso.essencial) return true;
  try {
    return (await configuracaoDoAviso(aviso, organizationId)).ativo;
  } catch {
    return false;
  }
}

export interface VersaoDoModelo {
  versao: number;
  texto: string | null;
  canal: CanalAviso;
  ativo: boolean;
  alteradoEm: string;
  alteradoPorNome?: string;
}

export interface ModeloParaEditor {
  finalidade: string;
  configuracao: ConfiguracaoDoAviso;
  atualizadoEm?: string;
  atualizadoPorNome?: string;
  versoes: VersaoDoModelo[];
  editavel: boolean;
}

function versoesDoHistorico(aviso: AvisoDoCatalogo, historico: readonly AlteracaoConfiguracao[]): VersaoDoModelo[] {
  return historico.map((linha) => {
    const configuracao = normalizarConfiguracao(aviso, linha.valorNovo);
    return {
      versao: configuracao.versao,
      texto: configuracao.texto,
      canal: configuracao.canal,
      ativo: configuracao.ativo,
      alteradoEm: linha.alteradoEm,
      alteradoPorNome: linha.alteradoPorNome,
    };
  });
}

export async function listarModelosParaEditor(organizationId: string): Promise<ModeloParaEditor[]> {
  return Promise.all(CATALOGO_AVISOS.map(async (aviso) => {
    const lida = await lerConfiguracaoGestao<unknown>(organizationId, PREFIXO_CHAVE_MODELO + aviso.finalidade);
    return {
      finalidade: aviso.finalidade,
      configuracao: normalizarConfiguracao(aviso, lida.valor),
      atualizadoEm: lida.atualizadoEm,
      atualizadoPorNome: lida.atualizadoPorNome,
      versoes: versoesDoHistorico(aviso, lida.historico),
      editavel: lida.editavel,
    };
  }));
}

/**
 * Grava uma nova versão. `texto: null` volta ao padrão — e também conta como
 * versão, para o histórico mostrar quando o texto próprio deixou de valer.
 */
export async function salvarModeloDoAviso(
  organizationId: string,
  finalidade: unknown,
  entrada: { texto?: unknown; canal?: unknown; ativo?: unknown },
  autor: AutorDaSessao
): Promise<ModeloParaEditor> {
  const aviso = typeof finalidade === 'string' ? avisoDoCatalogo(finalidade) : undefined;
  if (!aviso) throw new ApplicationError('INVALID_INPUT', 'Aviso desconhecido.', 400);

  const texto = typeof entrada.texto === 'string' && entrada.texto.trim() ? entrada.texto.replace(/\r\n/g, '\n') : null;
  if (texto !== null) {
    const problemas = validarModelo(texto, aviso.campos.map((campo) => campo.nome), aviso.camposObrigatorios);
    if (problemas.length) throw new ApplicationError('INVALID_INPUT', problemas.map((p) => p.mensagem).join(' '), 400);
  }
  if (typeof entrada.canal !== 'string' || !aviso.canais.includes(entrada.canal as CanalAviso)) {
    throw new ApplicationError('INVALID_INPUT', 'Escolha um canal disponível para este aviso.', 400);
  }
  if (!aviso.essencial && aviso.ativacaoEm === undefined && typeof entrada.ativo !== 'boolean') {
    throw new ApplicationError('INVALID_INPUT', 'Informe se o aviso complementar fica ativo.', 400);
  }

  const chave = PREFIXO_CHAVE_MODELO + aviso.finalidade;
  const atual = normalizarConfiguracao(aviso, (await lerConfiguracaoGestao<unknown>(organizationId, chave)).valor);
  const nova: ConfiguracaoDoAviso = {
    versao: atual.versao + 1,
    texto,
    canal: entrada.canal as CanalAviso,
    ativo: aviso.essencial ? true : aviso.ativacaoEm ? atual.ativo : entrada.ativo === true,
  };
  if (nova.texto === atual.texto && nova.canal === atual.canal && nova.ativo === atual.ativo) {
    throw new ApplicationError('INVALID_INPUT', 'Nada mudou em relação à versão atual.', 400);
  }
  await gravarConfiguracaoGestao(organizationId, chave, nova, autor);
  limparCacheDosModelos();
  return (await listarModelosParaEditor(organizationId)).find((item) => item.finalidade === aviso.finalidade)!;
}

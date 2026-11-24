import 'server-only';

import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import { avisoDoCatalogo } from '@/lib/avisos/catalogo';
import type { AuthSession } from '@/server/auth';
import { listarEnviosDeAvisos } from '@/server/communication/avisosEnviosRepository';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId } from '@/server/persistence/mysql/mappers';
import type { AutorDaSessao } from './autorGestao';
import { ApplicationError } from './http';
import { notificacoesDaSessao } from './notificacoesDaSessao';

/**
 * Área unificada de ocorrências que precisam de decisão da Gestão (13.06).
 *
 * As ocorrências são derivadas das fontes que as geram, como o sino: pedidos
 * sem profissional compatível ou com prazo estourado, aceite sem primeiro
 * agendamento, cadastros e pedidos de alteração aguardando análise, falhas de
 * checkout e de NFS-e e avisos não entregues. Cada uma aponta para o cadastro,
 * o pedido ou o pagamento de origem. A decisão da Gestão (próximo passo e
 * situação) é gravada com autor e data e acompanha a ocorrência pela chave.
 */

export type CategoriaOcorrencia = 'pedido' | 'cadastro' | 'agenda' | 'financeiro' | 'comunicacao';
export type SituacaoOcorrencia = 'aberta' | 'em_andamento' | 'resolvida';

export interface DecisaoOcorrencia {
  situacao: SituacaoOcorrencia;
  decisao: string;
  autorNome?: string;
  criadoEm: string;
}

export interface Ocorrencia {
  chave: string;
  categoria: CategoriaOcorrencia;
  titulo: string;
  descricao: string;
  ocorridoEm: string;
  href: string;
  situacao: SituacaoOcorrencia;
  decisoes: DecisaoOcorrencia[];
}

/** Tipos do sino que pedem decisão, e a categoria de cada um. */
const DO_SINO: Record<string, CategoriaOcorrencia> = {
  'lead-sem-profissional': 'pedido',
  'sla-estourado': 'pedido',
  'aceite-sem-agendamento': 'agenda',
  'solicitacao-perfil-pendente': 'cadastro',
  'credenciamento-em-analise': 'cadastro',
  'aprovado-sem-criterios': 'cadastro',
  'psicologo-ausente': 'cadastro',
};

const JANELA_DIAS = 90;

async function financeiras(organizationId: string, desde: Date): Promise<Omit<Ocorrencia, 'situacao' | 'decisoes'>[]> {
  if (!isMysqlConfigured()) return [];
  const pool = getMysqlPool();
  const [checkouts, notas] = await Promise.all([
    pool.query<RowDataPacket[]>(
      `SELECT cobranca_ref, erro_codigo, atualizado_em FROM financeiro_checkouts_asaas
        WHERE instituicao_id = ? AND organizacao_ref = ? AND status = 'failed' AND atualizado_em >= ?
        ORDER BY atualizado_em DESC LIMIT 200`,
      [instituicaoId(), organizationId, desde]
    ).then(([rows]) => rows).catch(() => [] as RowDataPacket[]),
    pool.query<RowDataPacket[]>(
      `SELECT cobranca_ref, erro_codigo, erro_mensagem, atualizado_em FROM fiscal_nfse_emissoes
        WHERE instituicao_id = ? AND organizacao_ref = ? AND status = 'failed' AND atualizado_em >= ?
        ORDER BY atualizado_em DESC LIMIT 200`,
      [instituicaoId(), organizationId, desde]
    ).then(([rows]) => rows).catch(() => [] as RowDataPacket[]),
  ]);
  return [
    ...checkouts.map((r) => ({
      chave: `checkout:${r.cobranca_ref}`, categoria: 'financeiro' as const,
      titulo: 'Falha ao gerar o pagamento no Asaas',
      descricao: `Cobrança ${r.cobranca_ref}${r.erro_codigo ? ` · código ${r.erro_codigo}` : ''}. O paciente não recebeu um link de pagamento válido.`,
      ocorridoEm: fromSqlTimestamp(r.atualizado_em) ?? new Date().toISOString(), href: '/gestao/financeiro',
    })),
    ...notas.map((r) => ({
      chave: `nfse:${r.cobranca_ref}`, categoria: 'financeiro' as const,
      titulo: 'NFS-e não emitida',
      descricao: `Cobrança ${r.cobranca_ref}${r.erro_codigo ? ` · ${r.erro_codigo}` : ''}${r.erro_mensagem ? ` · ${String(r.erro_mensagem).slice(0, 240)}` : ''}`,
      ocorridoEm: fromSqlTimestamp(r.atualizado_em) ?? new Date().toISOString(), href: '/gestao/financeiro',
    })),
  ];
}

async function avisosNaoEntregues(desde: Date): Promise<Omit<Ocorrencia, 'situacao' | 'decisoes'>[]> {
  return (await listarEnviosDeAvisos({ apenasNaoEntregues: true, desde, limite: 200 })).map((envio) => ({
    chave: `aviso:${envio.id}`, categoria: 'comunicacao' as const,
    titulo: `Aviso não entregue: ${avisoDoCatalogo(envio.finalidade)?.titulo ?? envio.finalidade.replace(/_/g, ' ')}`,
    descricao: `${envio.referencia ?? 'Sem referência'} · ${envio.situacao.replace(/_/g, ' ')}${envio.destinoFinal ? ` · destino final ${envio.destinoFinal}` : ''}`,
    ocorridoEm: envio.criadoEm, href: '/gestao/avisos?aba=envios',
  }));
}

let temTabela = false;
async function tabelaDisponivel(): Promise<boolean> {
  if (temTabela) return true;
  try {
    const [rows] = await getMysqlPool().query<RowDataPacket[]>(
      `SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'clinica_ocorrencias_decisoes'`
    );
    temTabela = Number(rows[0]?.total ?? 0) === 1;
  } catch {
    return false;
  }
  return temTabela;
}

const memoria = new Map<string, DecisaoOcorrencia[]>();

async function decisoesGravadas(organizationId: string, chaves: string[]): Promise<Map<string, DecisaoOcorrencia[]>> {
  if (!isMysqlConfigured()) return new Map([...memoria].filter(([chave]) => chaves.includes(chave)));
  if (!chaves.length || !(await tabelaDisponivel())) return new Map();
  const [rows] = await getMysqlPool().query<RowDataPacket[]>(
    `SELECT ocorrencia_chave, situacao, decisao, autor_nome, criado_em FROM clinica_ocorrencias_decisoes
      WHERE instituicao_id = ? AND organizacao_ref = ? AND ocorrencia_chave IN (?) ORDER BY criado_em DESC`,
    [instituicaoId(), organizationId, chaves]
  );
  const mapa = new Map<string, DecisaoOcorrencia[]>();
  for (const r of rows) {
    const lista = mapa.get(String(r.ocorrencia_chave)) ?? [];
    lista.push({ situacao: String(r.situacao) as SituacaoOcorrencia, decisao: String(r.decisao),
      autorNome: r.autor_nome ?? undefined, criadoEm: fromSqlTimestamp(r.criado_em) ?? new Date(0).toISOString() });
    mapa.set(String(r.ocorrencia_chave), lista);
  }
  return mapa;
}

export async function listarOcorrencias(sessao: AuthSession, agora: Date = new Date()): Promise<Ocorrencia[]> {
  const desde = new Date(agora.getTime() - JANELA_DIAS * 24 * 60 * 60 * 1000);
  const [sino, financeiro, avisos] = await Promise.all([
    notificacoesDaSessao(sessao, agora).catch(() => []),
    financeiras(sessao.organizationId, desde),
    avisosNaoEntregues(new Date(agora.getTime() - 30 * 24 * 60 * 60 * 1000)).catch(() => []),
  ]);
  const derivadas = [
    ...sino.filter((item) => DO_SINO[item.tipo]).map((item) => ({
      chave: item.chave, categoria: DO_SINO[item.tipo], titulo: item.titulo, descricao: item.descricao,
      ocorridoEm: item.ocorridoEm, href: item.href ?? '/gestao/cockpit',
    })),
    ...financeiro,
    ...avisos,
  ];
  const decisoes = await decisoesGravadas(sessao.organizationId, derivadas.map((item) => item.chave)).catch(() => new Map());
  return derivadas
    .map((item) => {
      const historico = decisoes.get(item.chave) ?? [];
      return { ...item, decisoes: historico, situacao: historico[0]?.situacao ?? ('aberta' as const) };
    })
    .sort((a, b) => b.ocorridoEm.localeCompare(a.ocorridoEm));
}

const SITUACOES: readonly SituacaoOcorrencia[] = ['aberta', 'em_andamento', 'resolvida'];

export async function registrarDecisaoOcorrencia(
  sessao: AuthSession,
  autor: AutorDaSessao,
  entrada: { chave?: unknown; situacao?: unknown; decisao?: unknown },
  agora: Date = new Date()
): Promise<Ocorrencia> {
  const chave = typeof entrada.chave === 'string' ? entrada.chave.trim() : '';
  const decisao = typeof entrada.decisao === 'string' ? entrada.decisao.trim() : '';
  const situacao = SITUACOES.find((s) => s === entrada.situacao);
  if (!situacao) throw new ApplicationError('INVALID_INPUT', 'Escolha a situação da ocorrência.', 400);
  if (decisao.length < 3) throw new ApplicationError('INVALID_INPUT', 'Escreva a decisão ou o próximo passo.', 400);
  if (decisao.length > 2000) throw new ApplicationError('INVALID_INPUT', 'A decisão passou de 2000 caracteres.', 400);
  const ocorrencia = (await listarOcorrencias(sessao, agora)).find((item) => item.chave === chave);
  if (!ocorrencia) throw new ApplicationError('NOT_FOUND', 'Ocorrência não encontrada ou já encerrada na origem.', 404);

  const registro: DecisaoOcorrencia = { situacao, decisao, autorNome: autor.nome, criadoEm: agora.toISOString() };
  if (!isMysqlConfigured()) {
    memoria.set(chave, [registro, ...(memoria.get(chave) ?? [])]);
  } else {
    if (!(await tabelaDisponivel())) {
      throw new ApplicationError('UNAVAILABLE', 'O registro de decisões requer a migration 106_ocorrencias_decisoes.sql.', 503);
    }
    await getMysqlPool().execute(
      `INSERT INTO clinica_ocorrencias_decisoes (id, instituicao_id, organizacao_ref, ocorrencia_chave, situacao, decisao, autor_ref, autor_nome, criado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [randomUUID(), instituicaoId(), sessao.organizationId, chave.slice(0, 255), situacao, decisao, autor.usuarioRef, autor.nome ?? null, agora]
    );
  }
  return { ...ocorrencia, situacao, decisoes: [registro, ...ocorrencia.decisoes] };
}

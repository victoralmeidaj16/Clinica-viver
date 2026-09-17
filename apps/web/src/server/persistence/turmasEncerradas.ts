import 'server-only';

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import { hojeEmBrasilia, type TurmaEncerrada } from '@/lib/turmaEncerrada';

/**
 * Turmas que a gestão marcou como encerradas.
 *
 * Só a turma é gravada; a saída de cada psicólogo é derivada na leitura do
 * roster (`comTurmasEncerradas`). Ver a migração 047.
 */

export interface TurmaEncerradaRegistro extends TurmaEncerrada {
  encerradaPor?: string;
}

export interface TurmasEncerradasRepository {
  listar(): Promise<TurmaEncerradaRegistro[]>;
  encerrar(turma: string, encerradaPor?: string): Promise<void>;
  reabrir(turma: string): Promise<void>;
}

function organizacaoRef(): string {
  return (
    process.env.ORGANIZATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() ||
    'org-viver-mais'
  );
}

function tabelaAusente(erro: unknown): boolean {
  return (erro as { code?: string }).code === 'ER_NO_SUCH_TABLE';
}

export class MigracaoTurmasPendenteError extends Error {
  readonly status = 503;
  constructor() {
    super('O encerramento de turmas ainda não está disponível: falta aplicar a migração 047 no banco.');
  }
}

function dataSql(valor: unknown): string {
  if (valor instanceof Date) {
    // Colunas DATE chegam como meia-noite local do processo; os componentes
    // locais são a data gravada.
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${valor.getFullYear()}-${mes}-${dia}`;
  }
  return String(valor).slice(0, 10);
}

class MysqlTurmasEncerradasRepository implements TurmasEncerradasRepository {
  constructor(private readonly conexao: Pool | PoolConnection = getMysqlPool()) {}

  async listar(): Promise<TurmaEncerradaRegistro[]> {
    try {
      const [rows] = await this.conexao.query<RowDataPacket[]>(
        `SELECT turma, encerrada_em, encerrada_por
           FROM clinica_turmas_encerradas
          WHERE instituicao_id = ? AND organizacao_ref = ?
          ORDER BY turma`,
        [instituicaoId(), organizacaoRef()]
      );
      return rows.map((row) => ({
        turma: String(row.turma),
        encerradaEm: dataSql(row.encerrada_em),
        encerradaPor: row.encerrada_por ? String(row.encerrada_por) : undefined,
      }));
    } catch (erro) {
      if (!tabelaAusente(erro)) throw erro;
      console.warn('[turmas] Tabela clinica_turmas_encerradas ausente — aplique a migração 047.');
      return [];
    }
  }

  async encerrar(turma: string, encerradaPor?: string): Promise<void> {
    try {
      await this.conexao.execute(
        `INSERT INTO clinica_turmas_encerradas
           (id, instituicao_id, organizacao_ref, turma, encerrada_em, encerrada_por)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE encerrada_em = encerrada_em`,
        [rowId('turma_encerrada', turma), instituicaoId(), organizacaoRef(), turma, hojeEmBrasilia(), encerradaPor ?? null]
      );
    } catch (erro) {
      if (tabelaAusente(erro)) throw new MigracaoTurmasPendenteError();
      throw erro;
    }
  }

  async reabrir(turma: string): Promise<void> {
    try {
      await this.conexao.execute(
        `DELETE FROM clinica_turmas_encerradas
          WHERE instituicao_id = ? AND organizacao_ref = ? AND turma = ?`,
        [instituicaoId(), organizacaoRef(), turma]
      );
    } catch (erro) {
      if (tabelaAusente(erro)) throw new MigracaoTurmasPendenteError();
      throw erro;
    }
  }
}

type ArquivoTurmas = Record<string, { encerradaEm: string; encerradaPor?: string }>;

function caminhoArquivo(): string {
  const snapshot = process.env.DEMO_STATE_FILE?.trim();
  const diretorio = snapshot ? dirname(snapshot) : join(process.cwd(), '.demo-state');
  return join(diretorio, 'turmas-encerradas.json');
}

/** Adaptador de arquivo, para a instalação sem MySQL. Sem transação, como os demais. */
class FileTurmasEncerradasRepository implements TurmasEncerradasRepository {
  private fila: Promise<void> = Promise.resolve();

  private async ler(): Promise<ArquivoTurmas> {
    try {
      return JSON.parse(await readFile(caminhoArquivo(), 'utf8')) as ArquivoTurmas;
    } catch {
      return {};
    }
  }

  private gravar(alterar: (atual: ArquivoTurmas) => ArquivoTurmas): Promise<void> {
    this.fila = this.fila.then(async () => {
      const alvo = caminhoArquivo();
      const temporario = `${alvo}.tmp`;
      await mkdir(dirname(alvo), { recursive: true });
      await writeFile(temporario, JSON.stringify(alterar(await this.ler()), null, 2), 'utf8');
      await rename(temporario, alvo);
    });
    return this.fila;
  }

  async listar(): Promise<TurmaEncerradaRegistro[]> {
    const conteudo = await this.ler();
    return Object.entries(conteudo)
      .map(([turma, item]) => ({
        turma,
        encerradaEm: item.encerradaEm,
        encerradaPor: item.encerradaPor,
      }))
      .sort((a, b) => a.turma.localeCompare(b.turma));
  }

  encerrar(turma: string, encerradaPor?: string): Promise<void> {
    return this.gravar((atual) =>
      atual[turma] ? atual : { ...atual, [turma]: { encerradaEm: hojeEmBrasilia(), encerradaPor } }
    );
  }

  reabrir(turma: string): Promise<void> {
    return this.gravar((atual) => {
      const resto = { ...atual };
      delete resto[turma];
      return resto;
    });
  }
}

const arquivo = new FileTurmasEncerradasRepository();

export function getTurmasEncerradasRepository(conexao?: Pool | PoolConnection): TurmasEncerradasRepository {
  return isMysqlConfigured() ? new MysqlTurmasEncerradasRepository(conexao) : arquivo;
}

/**
 * Anexa a cada cadastro o encerramento da turma dele, quando houver.
 *
 * Falha em silêncio pelo mesmo motivo das ausências da agenda: uma leitura
 * desta tabela não pode derrubar a fila de triagem. O custo é quem teve a turma
 * encerrada continuar recebendo até o banco responder de novo.
 */
export async function comTurmasEncerradas(
  cadastros: CadastroPsicologoRecord[],
  conexao?: Pool | PoolConnection
): Promise<CadastroPsicologoRecord[]> {
  if (cadastros.length === 0) return cadastros;
  try {
    const turmas = await getTurmasEncerradasRepository(conexao).listar();
    if (turmas.length === 0) return cadastros;
    const porTurma = new Map(turmas.map((item) => [item.turma, item]));
    return cadastros.map((cadastro) => {
      const encerramento = cadastro.turmaViverMais ? porTurma.get(cadastro.turmaViverMais) : undefined;
      return encerramento
        ? {
            ...cadastro,
            turmaEncerrada: { turma: encerramento.turma, encerradaEm: encerramento.encerradaEm },
          }
        : cadastro;
    });
  } catch (erro) {
    console.error('Erro ao ler turmas encerradas para o roster:', erro);
    return cadastros;
  }
}

import 'server-only';

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import type { CadastroPsicologoRecord } from '@/server/application/persistence';
import {
  chaveTurma,
  hojeEmBrasilia,
  normalizarIdentidadeTurma,
  type IdentidadeTurma,
  type TurmaEncerrada,
} from '@/lib/turmaEncerrada';

/** Encerramentos acadêmicos derivados por curso e código. Ver a migração 052. */
export interface TurmaEncerradaRegistro extends TurmaEncerrada {
  encerradaPor?: string;
}

export interface TurmasEncerradasRepository {
  listar(): Promise<TurmaEncerradaRegistro[]>;
  encerrar(identidade: IdentidadeTurma, encerradaPor?: string): Promise<void>;
  reabrir(identidade: IdentidadeTurma): Promise<void>;
  migrarLegadas(cadastros: readonly CadastroPsicologoRecord[]): Promise<void>;
}

function organizacaoRef(): string {
  return (
    process.env.ORGANIZATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() ||
    'org-viver-mais'
  );
}

function schemaPendente(erro: unknown): boolean {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR'].includes((erro as { code?: string }).code ?? '');
}

export class MigracaoTurmasPendenteError extends Error {
  readonly status = 503;
  constructor() {
    super('O encerramento de turmas ainda não está disponível: falta aplicar a migração 052 no banco.');
  }
}

function dataSql(valor: unknown): string {
  if (valor instanceof Date) {
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
        `SELECT turma, pos_graduacao, encerrada_em, encerrada_por
           FROM clinica_turmas_encerradas
          WHERE instituicao_id = ? AND organizacao_ref = ?
          ORDER BY pos_graduacao, turma`,
        [instituicaoId(), organizacaoRef()]
      );
      return rows.map((row) => ({
        turma: String(row.turma),
        posGraduacao: String(row.pos_graduacao),
        encerradaEm: dataSql(row.encerrada_em),
        encerradaPor: row.encerrada_por ? String(row.encerrada_por) : undefined,
      }));
    } catch (erro) {
      if (!schemaPendente(erro)) throw erro;
      console.warn('[turmas] Schema de turmas desatualizado — aplique a migração 052.');
      return [];
    }
  }

  async encerrar(identidade: IdentidadeTurma, encerradaPor?: string): Promise<void> {
    const normalizada = normalizarIdentidadeTurma(identidade);
    try {
      await this.conexao.execute(
        `INSERT INTO clinica_turmas_encerradas
           (id, instituicao_id, organizacao_ref, turma, pos_graduacao, encerrada_em, encerrada_por)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE encerrada_em = encerrada_em`,
        [
          rowId('turma_encerrada', chaveTurma(normalizada)),
          instituicaoId(),
          organizacaoRef(),
          normalizada.turma,
          normalizada.posGraduacao,
          hojeEmBrasilia(),
          encerradaPor ?? null,
        ]
      );
    } catch (erro) {
      if (schemaPendente(erro)) throw new MigracaoTurmasPendenteError();
      throw erro;
    }
  }

  async reabrir(identidade: IdentidadeTurma): Promise<void> {
    const normalizada = normalizarIdentidadeTurma(identidade);
    try {
      await this.conexao.execute(
        `DELETE FROM clinica_turmas_encerradas
          WHERE instituicao_id = ? AND organizacao_ref = ? AND turma = ? AND pos_graduacao = ?`,
        [instituicaoId(), organizacaoRef(), normalizada.turma, normalizada.posGraduacao]
      );
    } catch (erro) {
      if (schemaPendente(erro)) throw new MigracaoTurmasPendenteError();
      throw erro;
    }
  }

  async migrarLegadas(): Promise<void> {
    // A migração 052 faz a expansão no MySQL antes de a aplicação iniciar.
  }
}

type ArquivoTurmasLegado = Record<string, { encerradaEm: string; encerradaPor?: string }>;

interface ArquivoTurmasV2 {
  versao: 2;
  turmas: TurmaEncerradaRegistro[];
}

function arquivoV2(valor: unknown): valor is ArquivoTurmasV2 {
  if (!valor || typeof valor !== 'object') return false;
  const candidato = valor as Partial<ArquivoTurmasV2>;
  return candidato.versao === 2 && Array.isArray(candidato.turmas);
}

function caminhoArquivo(): string {
  const snapshot = process.env.DEMO_STATE_FILE?.trim();
  const diretorio = snapshot ? dirname(snapshot) : join(process.cwd(), '.demo-state');
  return join(diretorio, 'turmas-encerradas.json');
}

/** Adaptador de arquivo para demonstração e desenvolvimento sem MySQL. */
class FileTurmasEncerradasRepository implements TurmasEncerradasRepository {
  private fila: Promise<void> = Promise.resolve();

  private async ler(): Promise<ArquivoTurmasV2 | ArquivoTurmasLegado> {
    try {
      return JSON.parse(await readFile(caminhoArquivo(), 'utf8')) as ArquivoTurmasV2 | ArquivoTurmasLegado;
    } catch {
      return { versao: 2, turmas: [] };
    }
  }

  private enfileirar(gravar: () => Promise<void>): Promise<void> {
    this.fila = this.fila.catch(() => undefined).then(gravar);
    return this.fila;
  }

  private async escrever(conteudo: ArquivoTurmasV2): Promise<void> {
    const alvo = caminhoArquivo();
    const temporario = `${alvo}.tmp`;
    await mkdir(dirname(alvo), { recursive: true });
    await writeFile(temporario, JSON.stringify(conteudo, null, 2), 'utf8');
    await rename(temporario, alvo);
  }

  async listar(): Promise<TurmaEncerradaRegistro[]> {
    const conteudo = await this.ler();
    if (!arquivoV2(conteudo)) return [];
    return [...conteudo.turmas].sort((a, b) =>
      a.posGraduacao.localeCompare(b.posGraduacao, 'pt-BR') || a.turma.localeCompare(b.turma, 'pt-BR')
    );
  }

  encerrar(identidade: IdentidadeTurma, encerradaPor?: string): Promise<void> {
    return this.enfileirar(async () => {
      const conteudo = await this.ler();
      if (!arquivoV2(conteudo)) throw new MigracaoTurmasPendenteError();
      const normalizada = normalizarIdentidadeTurma(identidade);
      if (conteudo.turmas.some((item) => chaveTurma(item) === chaveTurma(normalizada))) return;
      await this.escrever({
        versao: 2,
        turmas: [...conteudo.turmas, { ...normalizada, encerradaEm: hojeEmBrasilia(), encerradaPor }],
      });
    });
  }

  reabrir(identidade: IdentidadeTurma): Promise<void> {
    return this.enfileirar(async () => {
      const conteudo = await this.ler();
      if (!arquivoV2(conteudo)) throw new MigracaoTurmasPendenteError();
      const chave = chaveTurma(identidade);
      await this.escrever({
        versao: 2,
        turmas: conteudo.turmas.filter((item) => chaveTurma(item) !== chave),
      });
    });
  }

  migrarLegadas(cadastros: readonly CadastroPsicologoRecord[]): Promise<void> {
    return this.enfileirar(async () => {
      const conteudo = await this.ler();
      if (arquivoV2(conteudo)) return;

      const combinacoes = new Map<string, IdentidadeTurma>();
      for (const cadastro of cadastros) {
        if (
          cadastro.status !== 'APROVADO' ||
          !cadastro.turmaViverMais?.trim() ||
          !cadastro.posGraduacaoViverMais?.trim()
        ) continue;
        const identidade = normalizarIdentidadeTurma({
          turma: cadastro.turmaViverMais,
          posGraduacao: cadastro.posGraduacaoViverMais,
        });
        combinacoes.set(chaveTurma(identidade), identidade);
      }

      const turmas: TurmaEncerradaRegistro[] = [];
      for (const [turmaLegada, dados] of Object.entries(conteudo)) {
        const codigo = turmaLegada.trim().toUpperCase();
        for (const identidade of combinacoes.values()) {
          if (identidade.turma !== codigo) continue;
          turmas.push({ ...identidade, encerradaEm: dados.encerradaEm, encerradaPor: dados.encerradaPor });
        }
      }
      await this.escrever({ versao: 2, turmas });
    });
  }
}

const arquivo = new FileTurmasEncerradasRepository();

export function getTurmasEncerradasRepository(conexao?: Pool | PoolConnection): TurmasEncerradasRepository {
  return isMysqlConfigured() ? new MysqlTurmasEncerradasRepository(conexao) : arquivo;
}

export function aplicarTurmasEncerradas(
  cadastros: CadastroPsicologoRecord[],
  encerradas: readonly TurmaEncerrada[]
): CadastroPsicologoRecord[] {
  const porIdentidade = new Map(encerradas.map((item) => [chaveTurma(item), item]));
  return cadastros.map((cadastro) => {
    const encerramento = cadastro.turmaViverMais && cadastro.posGraduacaoViverMais
      ? porIdentidade.get(chaveTurma({
          turma: cadastro.turmaViverMais,
          posGraduacao: cadastro.posGraduacaoViverMais,
        }))
      : undefined;
    return { ...cadastro, turmaEncerrada: encerramento ? { ...encerramento } : undefined };
  });
}

/** Anexa a cada cadastro somente o encerramento da combinação acadêmica dele. */
export async function comTurmasEncerradas(
  cadastros: CadastroPsicologoRecord[],
  conexao?: Pool | PoolConnection,
  repositorio: TurmasEncerradasRepository = getTurmasEncerradasRepository(conexao)
): Promise<CadastroPsicologoRecord[]> {
  if (cadastros.length === 0) return cadastros;
  try {
    await repositorio.migrarLegadas(cadastros);
    const turmas = await repositorio.listar();
    return aplicarTurmasEncerradas(cadastros, turmas);
  } catch (erro) {
    console.error('Erro ao ler turmas encerradas para o roster:', erro);
    return cadastros;
  }
}

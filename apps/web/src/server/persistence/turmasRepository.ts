import 'server-only';

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2';
import type { Pool, PoolConnection } from 'mysql2/promise';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, rowId } from '@/server/persistence/mysql/mappers';
import { chaveTurma, normalizarIdentidadeTurma } from '@/lib/turmaEncerrada';
import type { EventoTurma, TurmaRegistro } from '@/lib/turmasCiclo';

/**
 * Turmas cadastradas pela Gestão (migration 092). Sem a tabela, quem chama
 * recebe `null` em `listar` e segue com o encerramento antigo
 * (`turmasEncerradas.ts`).
 */

export interface TurmasRepository {
  /** `null`: cadastro de turmas indisponível (migration 092 pendente). */
  listar(): Promise<TurmaRegistro[] | null>;
  salvar(turma: TurmaRegistro): Promise<void>;
}

function organizacaoRef(): string {
  return process.env.ORGANIZATION_ID?.trim() || process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || 'org-viver-mais';
}

function data(valor: unknown): string | undefined {
  if (valor === null || valor === undefined) return undefined;
  if (valor instanceof Date) {
    return `${valor.getFullYear()}-${String(valor.getMonth() + 1).padStart(2, '0')}-${String(valor.getDate()).padStart(2, '0')}`;
  }
  return String(valor).slice(0, 10) || undefined;
}

function historico(valor: unknown): EventoTurma[] {
  let bruto = valor;
  if (typeof valor === 'string') {
    try { bruto = JSON.parse(valor) as unknown; } catch { return []; }
  }
  return Array.isArray(bruto)
    ? bruto.filter((item): item is EventoTurma => Boolean(item) && typeof (item as EventoTurma).acao === 'string')
    : [];
}

let tabelaDisponivel = false;

async function temTabela(conexao: Pool | PoolConnection): Promise<boolean> {
  if (tabelaDisponivel) return true;
  try {
    const [rows] = await conexao.query<RowDataPacket[]>(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'clinica_turmas' LIMIT 1`
    );
    tabelaDisponivel = rows.length > 0;
  } catch {
    return false;
  }
  return tabelaDisponivel;
}

class MysqlTurmasRepository implements TurmasRepository {
  constructor(private readonly conexao: Pool | PoolConnection = getMysqlPool()) {}

  async listar(): Promise<TurmaRegistro[] | null> {
    if (!(await temTabela(this.conexao))) return null;
    const [rows] = await this.conexao.query<RowDataPacket[]>(
      `SELECT id, pos_graduacao, codigo, data_inicio, data_encerramento_prevista, encerrada_em,
              saida_prevista_em, retirada_interrompida, historico
         FROM clinica_turmas
        WHERE instituicao_id = ? AND organizacao_ref = ?
        ORDER BY pos_graduacao, codigo`,
      [instituicaoId(), organizacaoRef()]
    );
    return rows.map((row) => ({
      id: String(row.id),
      posGraduacao: String(row.pos_graduacao),
      codigo: String(row.codigo),
      ...(data(row.data_inicio) ? { dataInicio: data(row.data_inicio) } : {}),
      ...(data(row.data_encerramento_prevista) ? { dataEncerramentoPrevista: data(row.data_encerramento_prevista) } : {}),
      ...(data(row.encerrada_em) ? { encerradaEm: data(row.encerrada_em) } : {}),
      ...(data(row.saida_prevista_em) ? { saidaManual: data(row.saida_prevista_em) } : {}),
      ...(row.retirada_interrompida ? { retiradaInterrompida: true } : {}),
      historico: historico(row.historico),
    }));
  }

  async salvar(turma: TurmaRegistro): Promise<void> {
    if (!(await temTabela(this.conexao))) {
      throw new Error('O cadastro de turmas requer a migration 092_turmas.sql.');
    }
    await this.conexao.execute(
      `INSERT INTO clinica_turmas
         (id, instituicao_id, organizacao_ref, pos_graduacao, codigo, data_inicio, data_encerramento_prevista,
          encerrada_em, saida_prevista_em, retirada_interrompida, historico)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
       ON DUPLICATE KEY UPDATE data_inicio = VALUES(data_inicio),
         data_encerramento_prevista = VALUES(data_encerramento_prevista), encerrada_em = VALUES(encerrada_em),
         saida_prevista_em = VALUES(saida_prevista_em), retirada_interrompida = VALUES(retirada_interrompida),
         historico = VALUES(historico)`,
      [turma.id, instituicaoId(), organizacaoRef(), turma.posGraduacao, turma.codigo, turma.dataInicio ?? null,
        turma.dataEncerramentoPrevista ?? null, turma.encerradaEm ?? null, turma.saidaManual ?? null,
        turma.retiradaInterrompida ? 1 : 0, JSON.stringify(turma.historico)]
    );
    await this.espelharLegado(turma);
  }

  /** Mantém `clinica_turmas_encerradas` igual, para uma versão anterior do código. */
  private async espelharLegado(turma: TurmaRegistro): Promise<void> {
    const identidade = normalizarIdentidadeTurma({ turma: turma.codigo, posGraduacao: turma.posGraduacao });
    try {
      if (turma.encerradaEm) {
        await this.conexao.execute(
          `INSERT INTO clinica_turmas_encerradas
             (id, instituicao_id, organizacao_ref, turma, pos_graduacao, encerrada_em, encerrada_por)
           VALUES (?, ?, ?, ?, ?, ?, NULL)
           ON DUPLICATE KEY UPDATE encerrada_em = VALUES(encerrada_em)`,
          [rowId('turma_encerrada', chaveTurma(identidade)), instituicaoId(), organizacaoRef(),
            identidade.turma, identidade.posGraduacao, turma.encerradaEm]
        );
      } else {
        await this.conexao.execute(
          `DELETE FROM clinica_turmas_encerradas
            WHERE instituicao_id = ? AND organizacao_ref = ? AND turma = ? AND pos_graduacao = ?`,
          [instituicaoId(), organizacaoRef(), identidade.turma, identidade.posGraduacao]
        );
      }
    } catch (erro) {
      console.warn('[turmas] Espelho do encerramento antigo não atualizado:', (erro as Error).message);
    }
  }
}

function caminhoArquivo(): string {
  const snapshot = process.env.DEMO_STATE_FILE?.trim();
  return join(snapshot ? dirname(snapshot) : join(process.cwd(), '.demo-state'), 'turmas.json');
}

/** Adaptador de arquivo para demonstração e desenvolvimento sem MySQL. */
class FileTurmasRepository implements TurmasRepository {
  private fila: Promise<void> = Promise.resolve();

  async listar(): Promise<TurmaRegistro[]> {
    try {
      const conteudo = JSON.parse(await readFile(caminhoArquivo(), 'utf8')) as { turmas?: TurmaRegistro[] };
      return Array.isArray(conteudo.turmas) ? conteudo.turmas : [];
    } catch {
      return [];
    }
  }

  salvar(turma: TurmaRegistro): Promise<void> {
    this.fila = this.fila.catch(() => undefined).then(async () => {
      const turmas = (await this.listar()).filter((item) => item.id !== turma.id);
      const alvo = caminhoArquivo();
      await mkdir(dirname(alvo), { recursive: true });
      await writeFile(`${alvo}.tmp`, JSON.stringify({ versao: 3, turmas: [...turmas, turma] }, null, 2), 'utf8');
      await rename(`${alvo}.tmp`, alvo);
    });
    return this.fila;
  }
}

const arquivo = new FileTurmasRepository();

export function getTurmasRepository(conexao?: Pool | PoolConnection): TurmasRepository {
  return isMysqlConfigured() ? new MysqlTurmasRepository(conexao) : arquivo;
}

export function novoIdDeTurma(): string {
  return randomUUID();
}

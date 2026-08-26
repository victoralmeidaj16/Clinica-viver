import 'server-only';

import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { gerarCodigoVerificacao } from '@thats-life/core';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { fromSqlTimestamp, instituicaoId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';

/**
 * Persistência das declarações de horas.
 *
 * A declaração emitida é registro permanente: o papel circula fora da clínica,
 * e a gestão precisa poder reconstituir meses depois o que foi atestado. Nada
 * aqui apaga linha — uma declaração que não vale mais é **revogada**, e a
 * revogação fica ao lado da emissão em vez de sumir com ela.
 *
 * O `codigo` continua sendo gerado e é a chave única de cada emissão, mas hoje
 * ele não sai daqui: o relatório de estágio deixou de trazer código de
 * conferência, e a conferência pública ficou com os certificados.
 */

export interface DeclaracaoHoras {
  id: string;
  codigo: string;
  psicologoCadastroId: string;
  profissionalId: string;
  psicologoNome: string;
  psicologoCrp: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  totalHoras: number;
  sessaoIds: readonly string[];
  conteudoHash: string;
  coordenadora: string;
  supervisora?: string;
  emitidoPor: string;
  emitidoEm: string;
  revogadaEm?: string;
  revogacaoMotivo?: string;
}

interface DeclaracaoRow extends RowDataPacket {
  id: string;
  codigo: string;
  psicologo_cadastro_ref: string;
  profissional_ref: string;
  psicologo_nome: string;
  psicologo_crp: string;
  curso: string;
  periodo_inicio: string;
  periodo_fim: string;
  total_sessoes: number;
  total_horas: number;
  sessoes_ref: unknown;
  conteudo_hash: string;
  coordenadora: string;
  supervisora: string | null;
  emitido_por_usuario_ref: string;
  emitido_em: string;
  revogada_em: string | null;
  revogacao_motivo: string | null;
}

function sessoes(valor: unknown): readonly string[] {
  if (Array.isArray(valor)) return valor.map(String);
  if (typeof valor === 'string') {
    try {
      const parsed = JSON.parse(valor) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toDeclaracao(row: DeclaracaoRow): DeclaracaoHoras {
  return {
    id: row.id,
    codigo: row.codigo,
    psicologoCadastroId: row.psicologo_cadastro_ref,
    profissionalId: row.profissional_ref,
    psicologoNome: row.psicologo_nome,
    psicologoCrp: row.psicologo_crp,
    curso: row.curso,
    // O pool roda com `dateStrings`, então `DATE` chega como `AAAA-MM-DD` e o
    // recorte só protege contra uma coluna que mude de tipo. Deixar o driver
    // construir `Date` aqui traria o fuso do processo para dentro de uma data
    // que não tem hora — e `emitido_em`, que entra no hash, deixaria de bater
    // consigo mesmo na conferência.
    periodoInicio: row.periodo_inicio.slice(0, 10),
    periodoFim: row.periodo_fim.slice(0, 10),
    totalSessoes: Number(row.total_sessoes),
    totalHoras: Number(row.total_horas),
    sessaoIds: sessoes(row.sessoes_ref),
    conteudoHash: row.conteudo_hash,
    coordenadora: row.coordenadora,
    supervisora: row.supervisora ?? undefined,
    emitidoPor: row.emitido_por_usuario_ref,
    emitidoEm: fromSqlTimestamp(row.emitido_em)!,
    revogadaEm: fromSqlTimestamp(row.revogada_em),
    revogacaoMotivo: row.revogacao_motivo ?? undefined,
  };
}

const SELECT = `SELECT id, codigo, psicologo_cadastro_ref, profissional_ref, psicologo_nome,
  psicologo_crp, curso, periodo_inicio, periodo_fim, total_sessoes, total_horas, sessoes_ref,
  conteudo_hash, coordenadora, supervisora, emitido_por_usuario_ref, emitido_em,
  revogada_em, revogacao_motivo
  FROM clinica_declaracoes_horas`;

export function exigirPersistenciaDeclaracao() {
  if (!isMysqlConfigured()) {
    throw new Error(
      'A emissão de declarações exige o MySQL configurado: o registro da emissão precisa sobreviver ao processo.'
    );
  }
}

export interface NovaDeclaracao {
  organizationId: string;
  psicologoCadastroId: string;
  profissionalId: string;
  psicologoNome: string;
  psicologoCrp: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  totalHoras: number;
  sessaoIds: readonly string[];
  coordenadora: string;
  supervisora?: string;
  emitidoPor: string;
}

export class DeclaracaoHorasRepository {
  constructor(private readonly pool: Pool = getMysqlPool()) {}

  /**
   * Grava a declaração, resolvendo a colisão de código na própria escrita.
   *
   * O código vem de 8 caracteres sorteados, e a chance de repetir é ínfima —
   * mas "ínfima" não é "impossível", e a consequência de ignorá-la seria uma
   * conferência devolvendo a declaração de outra pessoa. A unicidade é do
   * banco; aqui só se sorteia de novo quando ele recusa.
   *
   * `emitidoEm` e o hash entram prontos porque o hash cobre o instante: quem
   * calcula os dois precisa ser o mesmo, e é quem chama.
   */
  async registrar(
    input: NovaDeclaracao,
    calcularHash: (codigo: string, emitidoEm: string) => Promise<string>
  ): Promise<DeclaracaoHoras> {
    const emitidoEm = new Date().toISOString();

    for (let tentativa = 0; tentativa < 5; tentativa += 1) {
      const codigo = gerarCodigoVerificacao();
      const id = crypto.randomUUID();
      const conteudoHash = await calcularHash(codigo, emitidoEm);

      try {
        await this.pool.query<ResultSetHeader>(
          `INSERT INTO clinica_declaracoes_horas
            (id, instituicao_id, organizacao_ref, codigo, psicologo_cadastro_ref, profissional_ref,
             psicologo_nome, psicologo_crp, curso, periodo_inicio, periodo_fim, total_sessoes,
             total_horas, sessoes_ref, conteudo_hash, coordenadora, supervisora,
             emitido_por_usuario_ref, emitido_em)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)`,
          [
            id, instituicaoId(), input.organizationId, codigo, input.psicologoCadastroId,
            input.profissionalId, input.psicologoNome, input.psicologoCrp, input.curso,
            input.periodoInicio, input.periodoFim, input.totalSessoes, input.totalHoras,
            JSON.stringify([...input.sessaoIds]), conteudoHash, input.coordenadora,
            input.supervisora ?? null, input.emitidoPor, toSqlTimestamp(emitidoEm),
          ]
        );

        return {
          id, codigo, psicologoCadastroId: input.psicologoCadastroId,
          profissionalId: input.profissionalId, psicologoNome: input.psicologoNome,
          psicologoCrp: input.psicologoCrp, curso: input.curso,
          periodoInicio: input.periodoInicio, periodoFim: input.periodoFim,
          totalSessoes: input.totalSessoes, totalHoras: input.totalHoras,
          sessaoIds: [...input.sessaoIds], conteudoHash, coordenadora: input.coordenadora,
          supervisora: input.supervisora, emitidoPor: input.emitidoPor, emitidoEm,
        };
      } catch (erro) {
        const duplicado =
          typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'ER_DUP_ENTRY';
        if (!duplicado) throw erro;
      }
    }

    throw new Error('Não foi possível gerar um código de conferência inédito para a declaração.');
  }

  /** Histórico do psicólogo, da mais recente para a mais antiga. */
  async porPsicologo(
    organizationId: string,
    psicologoCadastroId: string
  ): Promise<readonly DeclaracaoHoras[]> {
    const [rows] = await this.pool.query<DeclaracaoRow[]>(
      `${SELECT} WHERE instituicao_id = ? AND organizacao_ref = ? AND psicologo_cadastro_ref = ?
       ORDER BY emitido_em DESC`,
      [instituicaoId(), organizationId, psicologoCadastroId]
    );
    return rows.map(toDeclaracao);
  }

  /**
   * Revoga uma declaração já emitida.
   *
   * Só a primeira revogação vale: `revogada_em IS NULL` na cláusula impede que
   * uma segunda chamada reescreva a data e o motivo do que já foi revogado.
   */
  async revogar(organizationId: string, codigo: string, motivo: string): Promise<boolean> {
    const [resultado] = await this.pool.query<ResultSetHeader>(
      `UPDATE clinica_declaracoes_horas
          SET revogada_em = CURRENT_TIMESTAMP(3), revogacao_motivo = ?
        WHERE instituicao_id = ? AND organizacao_ref = ? AND codigo = ? AND revogada_em IS NULL`,
      [motivo, instituicaoId(), organizationId, codigo]
    );
    return resultado.affectedRows === 1;
  }
}

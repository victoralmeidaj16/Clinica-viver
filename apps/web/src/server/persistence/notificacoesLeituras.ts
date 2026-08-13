import 'server-only';

import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, rowId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';

/**
 * Quais notificações cada pessoa já viu.
 *
 * Só a marca de leitura é persistida; o texto da notificação nasce da fila de
 * triagem e do credenciamento a cada requisição (`application/notificacoes.ts`).
 * Guardar o conteúdo criaria uma segunda verdade sobre o mesmo paciente — um
 * aviso dizendo "aguardando contato" depois de o contato ter sido confirmado é
 * pior do que aviso nenhum.
 *
 * A leitura é por usuário, não por dispositivo: quem leu no celular não vê o
 * mesmo ponto vermelho ao abrir o computador.
 */

const RETENCAO_DIAS = 90;

export interface LeiturasRepository {
  /** Chaves já lidas por este usuário. */
  lidas(usuarioRef: string): Promise<Set<string>>;
  /** Marca as chaves como lidas. Idempotente: remarcar não muda o instante. */
  marcar(usuarioRef: string, chaves: readonly string[]): Promise<void>;
}

function organizacaoRef(): string {
  return (
    process.env.ORGANIZATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() ||
    'org-viver-mais'
  );
}

/**
 * Banco sem a migração 019 aplicada.
 *
 * Vale a pena distinguir este erro dos demais: sem a tabela, tudo o que se
 * perde é a memória do que já foi lido — as notificações continuam corretas,
 * apenas voltam a aparecer como novas. Derrubar o sino inteiro por causa disso
 * esconderia avisos de SLA vencido atrás de uma tela de erro.
 */
function tabelaAusente(erro: unknown): boolean {
  return (erro as { code?: string }).code === 'ER_NO_SUCH_TABLE';
}

function avisarMigracaoPendente(erro: unknown): void {
  console.warn(
    '[notificações] Tabela clinica_notificacoes_leituras ausente — aplique a migração 019 ' +
      '(`npm run db:migrate`). Até lá, as notificações não guardam o estado de lida.',
    erro
  );
}

class MysqlLeiturasRepository implements LeiturasRepository {
  async lidas(usuarioRef: string): Promise<Set<string>> {
    try {
      const [rows] = await getMysqlPool().query<Array<RowDataPacket & { notificacao_chave: string }>>(
        `SELECT notificacao_chave
           FROM clinica_notificacoes_leituras
          WHERE instituicao_id = ? AND organizacao_ref = ? AND usuario_ref = ?`,
        [instituicaoId(), organizacaoRef(), usuarioRef]
      );
      return new Set(rows.map((row) => row.notificacao_chave));
    } catch (erro) {
      if (!tabelaAusente(erro)) throw erro;
      avisarMigracaoPendente(erro);
      return new Set();
    }
  }

  async marcar(usuarioRef: string, chaves: readonly string[]): Promise<void> {
    if (chaves.length === 0) return;
    try {
      await this.gravar(usuarioRef, chaves);
    } catch (erro) {
      if (!tabelaAusente(erro)) throw erro;
      avisarMigracaoPendente(erro);
    }
  }

  private async gravar(usuarioRef: string, chaves: readonly string[]): Promise<void> {
    const agora = toSqlTimestamp(new Date().toISOString());
    const pool = getMysqlPool();

    for (const chave of chaves) {
      await pool.execute(
        `INSERT INTO clinica_notificacoes_leituras
           (id, instituicao_id, organizacao_ref, usuario_ref, notificacao_chave, lida_em)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE lida_em = lida_em`,
        [
          rowId('notificacao_leitura', `${usuarioRef}:${chave}`),
          instituicaoId(),
          organizacaoRef(),
          usuarioRef,
          chave,
          agora,
        ]
      );
    }

    // A chave de uma notificação some quando o evento sai da janela de
    // retenção; a marca de leitura correspondente ficaria para sempre. A poda
    // acontece na escrita para não pendurar um agendador só por causa disto.
    // O intervalo é interpolado por ser constante do código, não entrada de
    // ninguém: `INTERVAL ?` nem sempre sobrevive ao prepare do servidor.
    await pool.execute(
      `DELETE FROM clinica_notificacoes_leituras
        WHERE instituicao_id = ? AND usuario_ref = ?
          AND lida_em < DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL ${RETENCAO_DIAS} DAY)`,
      [instituicaoId(), usuarioRef]
    );
  }
}

type ArquivoLeituras = Record<string, Record<string, string>>;

function caminhoArquivo(): string {
  const snapshot = process.env.DEMO_STATE_FILE?.trim();
  const diretorio = snapshot ? dirname(snapshot) : join(process.cwd(), '.demo-state');
  return join(diretorio, 'notificacoes-leituras.json');
}

/**
 * Adaptador de arquivo, para a instalação sem MySQL.
 *
 * Mesma limitação declarada em `FileCaptureRepository`: sem transação, duas
 * requisições simultâneas podem se sobrescrever. O prejuízo aqui é um aviso
 * reaparecendo como não lido — não a perda de um dado clínico.
 */
class FileLeiturasRepository implements LeiturasRepository {
  private fila: Promise<void> = Promise.resolve();

  private async ler(): Promise<ArquivoLeituras> {
    try {
      return JSON.parse(await readFile(caminhoArquivo(), 'utf8')) as ArquivoLeituras;
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[notificações] Marcas de leitura ilegíveis, recomeçando vazias:', erro);
      }
      return {};
    }
  }

  async lidas(usuarioRef: string): Promise<Set<string>> {
    const conteudo = await this.ler();
    return new Set(Object.keys(conteudo[usuarioRef] ?? {}));
  }

  async marcar(usuarioRef: string, chaves: readonly string[]): Promise<void> {
    if (chaves.length === 0) return;

    this.fila = this.fila.then(async () => {
      const conteudo = await this.ler();
      const doUsuario = { ...(conteudo[usuarioRef] ?? {}) };
      const agora = new Date().toISOString();
      const limite = Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000;

      for (const chave of chaves) {
        doUsuario[chave] = doUsuario[chave] ?? agora;
      }

      const retidas = Object.fromEntries(
        Object.entries(doUsuario).filter(([, lidaEm]) => new Date(lidaEm).getTime() >= limite)
      );

      const alvo = caminhoArquivo();
      const temporario = `${alvo}.tmp`;
      try {
        await mkdir(dirname(alvo), { recursive: true });
        await writeFile(temporario, JSON.stringify({ ...conteudo, [usuarioRef]: retidas }, null, 2), 'utf8');
        await rename(temporario, alvo);
      } catch (erro) {
        console.warn('[notificações] Não foi possível gravar as marcas de leitura:', erro);
      }
    });

    return this.fila;
  }
}

const arquivo = new FileLeiturasRepository();

export function getLeiturasRepository(): LeiturasRepository {
  return isMysqlConfigured() ? new MysqlLeiturasRepository() : arquivo;
}

import 'server-only';

import { readFile, mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { RowDataPacket } from 'mysql2';
import type { MudancaPerfil } from '@/lib/perfilPsicologoDiff';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId, rowId, toSqlTimestamp } from '@/server/persistence/mysql/mappers';

/**
 * O que cada psicólogo alterou no próprio perfil, e quando.
 *
 * Existe para alimentar o sino da gestão sem quebrar a regra de que aviso não
 * se grava — ver o cabeçalho de `031_perfil_alteracoes.sql`. Aqui mora o fato
 * (o diff); a notificação continua sendo derivada dele a cada leitura, e a
 * marca de "já vi" continua em `notificacoesLeituras.ts`.
 */

export interface AlteracaoPerfil {
  cadastroRef: string;
  psicologoNome: string;
  alteradoEm: string;
  mudancas: MudancaPerfil[];
}

export interface PerfilAlteracoesRepository {
  /** Grava uma edição. Sem mudanças, não grava nada. */
  registrar(entrada: AlteracaoPerfil & { usuarioRef: string }): Promise<void>;
  /** Edições a partir de um instante, da mais recente para a mais antiga. */
  recentes(desde: Date): Promise<AlteracaoPerfil[]>;
}

/** Teto de linhas lidas: a retenção do sino já corta em 30 dias. */
const LIMITE_LEITURA = 60;

function organizacaoRef(): string {
  return (
    process.env.ORGANIZATION_ID?.trim() ||
    process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() ||
    'org-viver-mais'
  );
}

/**
 * Banco sem a migração 031 aplicada.
 *
 * Mesma escolha de `notificacoesLeituras.ts`: sem a tabela, o que se perde é o
 * aviso de alteração de perfil — a fila de triagem e o SLA continuam
 * aparecendo. Derrubar o sino inteiro por causa disto esconderia atrás de uma
 * tela de erro o paciente que ninguém contatou.
 */
function tabelaAusente(erro: unknown): boolean {
  return (erro as { code?: string }).code === 'ER_NO_SUCH_TABLE';
}

function avisarMigracaoPendente(erro: unknown): void {
  console.warn(
    '[perfil] Tabela clinica_psicologos_alteracoes_perfil ausente — aplique a migração 031 ' +
      '(`npm run db:migrate`). Até lá, alterações de perfil não notificam a gestão.',
    erro
  );
}

function normalizarMudancas(valor: unknown): MudancaPerfil[] {
  // O driver devolve JSON já desserializado, mas uma linha gravada por outra
  // versão pode vir como texto. Ler os dois evita que um aviso suma por causa
  // do formato.
  const bruto = typeof valor === 'string' ? safeParse(valor) : valor;
  if (!Array.isArray(bruto)) return [];
  return bruto.filter(
    (item): item is MudancaPerfil =>
      Boolean(item) && typeof item === 'object' && typeof (item as MudancaPerfil).rotulo === 'string'
  );
}

function safeParse(texto: string): unknown {
  try {
    return JSON.parse(texto);
  } catch {
    return null;
  }
}

class MysqlPerfilAlteracoesRepository implements PerfilAlteracoesRepository {
  async registrar(entrada: AlteracaoPerfil & { usuarioRef: string }): Promise<void> {
    if (entrada.mudancas.length === 0) return;
    try {
      await getMysqlPool().execute(
        `INSERT INTO clinica_psicologos_alteracoes_perfil
           (id, instituicao_id, organizacao_ref, cadastro_ref, psicologo_nome,
            alterado_por_usuario_ref, alterado_em, mudancas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mudancas = VALUES(mudancas)`,
        [
          rowId('perfil_alteracao', `${entrada.cadastroRef}:${entrada.alteradoEm}`),
          instituicaoId(),
          organizacaoRef(),
          entrada.cadastroRef,
          entrada.psicologoNome,
          entrada.usuarioRef,
          toSqlTimestamp(entrada.alteradoEm),
          JSON.stringify(entrada.mudancas),
        ]
      );
    } catch (erro) {
      if (!tabelaAusente(erro)) throw erro;
      avisarMigracaoPendente(erro);
    }
  }

  async recentes(desde: Date): Promise<AlteracaoPerfil[]> {
    try {
      const [rows] = await getMysqlPool().query<RowDataPacket[]>(
        `SELECT cadastro_ref, psicologo_nome, alterado_em, mudancas
           FROM clinica_psicologos_alteracoes_perfil
          WHERE instituicao_id = ? AND organizacao_ref = ? AND alterado_em >= ?
          ORDER BY alterado_em DESC
          LIMIT ${LIMITE_LEITURA}`,
        [instituicaoId(), organizacaoRef(), toSqlTimestamp(desde.toISOString())]
      );
      return rows.map((row) => ({
        cadastroRef: String(row.cadastro_ref),
        psicologoNome: String(row.psicologo_nome),
        alteradoEm: new Date(row.alterado_em).toISOString(),
        mudancas: normalizarMudancas(row.mudancas),
      }));
    } catch (erro) {
      if (!tabelaAusente(erro)) throw erro;
      avisarMigracaoPendente(erro);
      return [];
    }
  }
}

type ArquivoAlteracoes = Array<AlteracaoPerfil & { usuarioRef: string }>;

function caminhoArquivo(): string {
  const snapshot = process.env.DEMO_STATE_FILE?.trim();
  const diretorio = snapshot ? dirname(snapshot) : join(process.cwd(), '.demo-state');
  return join(diretorio, 'perfil-alteracoes.json');
}

/**
 * Adaptador de arquivo, para a instalação sem MySQL.
 *
 * Mesma limitação declarada em `FileCaptureRepository`: sem transação, duas
 * requisições simultâneas podem se sobrescrever. O prejuízo aqui é um aviso de
 * alteração perdido na demonstração — não um dado clínico.
 */
class FilePerfilAlteracoesRepository implements PerfilAlteracoesRepository {
  private fila: Promise<void> = Promise.resolve();

  private async ler(): Promise<ArquivoAlteracoes> {
    try {
      const conteudo = JSON.parse(await readFile(caminhoArquivo(), 'utf8'));
      return Array.isArray(conteudo) ? (conteudo as ArquivoAlteracoes) : [];
    } catch (erro) {
      if ((erro as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.warn('[perfil] Alterações ilegíveis, recomeçando vazias:', erro);
      }
      return [];
    }
  }

  async registrar(entrada: AlteracaoPerfil & { usuarioRef: string }): Promise<void> {
    if (entrada.mudancas.length === 0) return;

    this.fila = this.fila.then(async () => {
      const atuais = await this.ler();
      const jaGravada = atuais.some(
        (item) => item.cadastroRef === entrada.cadastroRef && item.alteradoEm === entrada.alteradoEm
      );
      const proximas = (jaGravada ? atuais : [entrada, ...atuais]).slice(0, LIMITE_LEITURA);

      const alvo = caminhoArquivo();
      const temporario = `${alvo}.tmp`;
      try {
        await mkdir(dirname(alvo), { recursive: true });
        await writeFile(temporario, JSON.stringify(proximas, null, 2), 'utf8');
        await rename(temporario, alvo);
      } catch (erro) {
        console.warn('[perfil] Não foi possível gravar a alteração de perfil:', erro);
      }
    });

    return this.fila;
  }

  async recentes(desde: Date): Promise<AlteracaoPerfil[]> {
    const limite = desde.getTime();
    return (await this.ler())
      .filter((item) => new Date(item.alteradoEm).getTime() >= limite)
      .sort((a, b) => new Date(b.alteradoEm).getTime() - new Date(a.alteradoEm).getTime());
  }
}

const arquivo = new FilePerfilAlteracoesRepository();

export function getPerfilAlteracoesRepository(): PerfilAlteracoesRepository {
  return isMysqlConfigured() ? new MysqlPerfilAlteracoesRepository() : arquivo;
}

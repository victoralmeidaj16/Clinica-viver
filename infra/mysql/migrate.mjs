#!/usr/bin/env node
/**
 * Aplicador de migrações do MySQL.
 *
 * Até aqui os DDLs eram aplicados à mão, na ordem descrita em prosa no
 * cabeçalho do 000_criar_banco_clinica.sh e numa tabela do docs/oci-migracao.md
 * que parou no 009. Não havia como saber, olhando um banco, o que já tinha sido
 * aplicado — e a resposta importava, porque alguns arquivos existem só para
 * instalações antigas.
 *
 * Roda com credencial ADMINISTRATIVA (MYSQL_ADMIN_URL), não com a da aplicação:
 * `viver_mais_app` recebe apenas SELECT/INSERT/UPDATE/DELETE de propósito, sem
 * DDL, para que um comprometimento da aplicação não consiga alterar o esquema.
 *
 *   MYSQL_ADMIN_URL='mysql://root:senha@127.0.0.1:3307/viver_mais_clinica' \
 *     node infra/mysql/migrate.mjs [--dry-run]
 *
 * Os arquivos são idempotentes por construção (guardas em information_schema +
 * PREPARE/EXECUTE), o que importa porque o MySQL faz commit implícito em cada
 * DDL: uma migração que falhar no meio fica parcialmente aplicada e será
 * reexecutada do início na próxima tentativa.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createConnection } from 'mysql2/promise';

const DIRETORIO = dirname(fileURLToPath(import.meta.url));
const DRY_RUN = process.argv.includes('--dry-run');

/**
 * Separa o arquivo em comandos individuais.
 *
 * Não dá para entregar o arquivo inteiro ao driver: `DELIMITER` é diretiva do
 * cliente `mysql`, não comando do servidor, e o 008 depende dela para declarar
 * uma função cujo corpo contém `;`. Sem tratá-la aqui, o servidor cortaria o
 * `CREATE FUNCTION` no primeiro ponto e vírgula interno.
 *
 * O varredor precisa conhecer aspas e comentários pelo mesmo motivo de sempre:
 * um `;` dentro de literal ou de comentário não termina comando nenhum.
 */
function separarComandos(sql) {
  const comandos = [];
  let delimitador = ';';
  let atual = '';
  let i = 0;

  while (i < sql.length) {
    const resto = sql.slice(i);

    // Diretiva DELIMITER: só vale no início de uma linha.
    if ((i === 0 || sql[i - 1] === '\n') && /^delimiter[ \t]+/i.test(resto)) {
      const fimDaLinha = sql.indexOf('\n', i);
      const linha = sql.slice(i, fimDaLinha === -1 ? sql.length : fimDaLinha);
      delimitador = linha.replace(/^delimiter[ \t]+/i, '').trim();
      i = fimDaLinha === -1 ? sql.length : fimDaLinha + 1;
      continue;
    }

    const caractere = sql[i];

    if (caractere === '-' && sql[i + 1] === '-' && /[\s]/.test(sql[i + 2] ?? '\n')) {
      const fim = sql.indexOf('\n', i);
      i = fim === -1 ? sql.length : fim + 1;
      atual += '\n';
      continue;
    }

    if (caractere === '#') {
      const fim = sql.indexOf('\n', i);
      i = fim === -1 ? sql.length : fim + 1;
      atual += '\n';
      continue;
    }

    if (caractere === '/' && sql[i + 1] === '*') {
      const fim = sql.indexOf('*/', i + 2);
      i = fim === -1 ? sql.length : fim + 2;
      continue;
    }

    if (caractere === "'" || caractere === '"' || caractere === '`') {
      const aspas = caractere;
      let j = i + 1;
      atual += caractere;
      while (j < sql.length) {
        if (sql[j] === '\\' && aspas !== '`') {
          atual += sql.slice(j, j + 2);
          j += 2;
          continue;
        }
        // Aspa duplicada é escape dela mesma: 'a''b'.
        if (sql[j] === aspas && sql[j + 1] === aspas) {
          atual += sql.slice(j, j + 2);
          j += 2;
          continue;
        }
        atual += sql[j];
        if (sql[j] === aspas) {
          j += 1;
          break;
        }
        j += 1;
      }
      i = j;
      continue;
    }

    if (resto.startsWith(delimitador)) {
      const comando = atual.trim();
      if (comando) comandos.push(comando);
      atual = '';
      i += delimitador.length;
      continue;
    }

    atual += caractere;
    i += 1;
  }

  const ultimo = atual.trim();
  if (ultimo) comandos.push(ultimo);
  return comandos;
}

/**
 * Só arquivos numerados na raiz de infra/mysql. Os `.sh` provisionam banco,
 * usuário e TLS antes disto; `seeds/` fica de fora porque semente não é
 * esquema e não pode entrar em produção por descuido de ordenação.
 */
async function listarMigracoes() {
  const entradas = await readdir(DIRETORIO, { withFileTypes: true });
  return entradas
    .filter((entrada) => entrada.isFile() && /^\d{3}_.+\.sql$/.test(entrada.name))
    .map((entrada) => entrada.name)
    .sort();
}

function checksumDe(conteudo) {
  return createHash('sha256').update(conteudo, 'utf8').digest('hex');
}

async function garantirTabelaDeControle(conexao) {
  await conexao.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      versao VARCHAR(64) NOT NULL,
      nome VARCHAR(255) NOT NULL,
      checksum CHAR(64) NOT NULL,
      aplicado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (versao)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function main() {
  const url = process.env.MYSQL_ADMIN_URL?.trim();
  if (!url) {
    console.error(
      'MYSQL_ADMIN_URL não definida.\n' +
        'Dev:  MYSQL_ADMIN_URL=mysql://root:dev-root-local@127.0.0.1:3307/viver_mais_clinica\n' +
        'Prod: use a credencial administrativa da OCI, nunca a da aplicação.'
    );
    process.exit(1);
  }

  const conexao = await createConnection({ uri: url });
  try {
    await garantirTabelaDeControle(conexao);

    const [linhas] = await conexao.query('SELECT versao, nome, checksum FROM schema_migrations');
    const aplicadas = new Map(linhas.map((linha) => [linha.versao, linha]));

    const arquivos = await listarMigracoes();
    let executadas = 0;

    for (const arquivo of arquivos) {
      const versao = arquivo.slice(0, 3);
      const conteudo = await readFile(join(DIRETORIO, arquivo), 'utf8');
      const checksum = checksumDe(conteudo);
      const anterior = aplicadas.get(versao);

      if (anterior) {
        // Editar uma migração já aplicada faz o banco divergir do repositório
        // em silêncio. Corrigir esquema é papel de uma migração nova.
        if (anterior.checksum !== checksum) {
          throw new Error(
            `A migração ${versao} (${anterior.nome}) já foi aplicada, mas o arquivo mudou desde então.\n` +
              'Crie uma migração nova em vez de editar esta. Se o arquivo apenas foi renomeado ' +
              `(${anterior.nome} → ${arquivo}), ajuste a linha em schema_migrations à mão.`
          );
        }
        console.log(`  ok    ${arquivo} (já aplicada)`);
        continue;
      }

      const comandos = separarComandos(conteudo);

      if (DRY_RUN) {
        console.log(`  seria aplicada: ${arquivo} (${comandos.length} comandos)`);
        executadas += 1;
        continue;
      }

      process.stdout.write(`  aplicando ${arquivo} (${comandos.length} comandos) ... `);
      for (const comando of comandos) {
        await conexao.query(comando);
      }
      await conexao.query(
        'INSERT INTO schema_migrations (versao, nome, checksum) VALUES (?, ?, ?)',
        [versao, arquivo, checksum]
      );
      console.log('ok');
      executadas += 1;
    }

    console.log(
      executadas === 0
        ? '\nEsquema já está atualizado.'
        : `\n${executadas} migração(ões) ${DRY_RUN ? 'pendente(s)' : 'aplicada(s)'}.`
    );
  } finally {
    await conexao.end();
  }
}

main().catch((erro) => {
  console.error('\nFalha na migração:', erro.message);
  process.exit(1);
});

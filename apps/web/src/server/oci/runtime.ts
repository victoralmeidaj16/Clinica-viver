import 'server-only';

import { readFileSync } from 'node:fs';
import { createPool, type Pool, type PoolOptions } from 'mysql2/promise';

/**
 * Conexão com o MySQL da OCI.
 *
 * Portado de `Sponteiro/apps/viver-mais-web/src/lib/oci/runtime.ts`, sem o
 * cliente Redis: o primeiro recorte de migração usa MySQL também para jobs, e
 * cache distribuído só entra quando houver necessidade comprovada.
 *
 * O endpoint do DB System não tem IP público. Em produção a aplicação roda
 * dentro da VCN; em desenvolvimento, por túnel SSH até a VM. Em nenhum dos dois
 * casos o banco é exposto por load balancer.
 */

type Health = 'not_configured' | 'ok' | 'error';

interface MysqlConfig {
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  sslCa?: string;
}

interface RuntimeClients {
  mysql?: Pool;
}

const globalForOci = globalThis as typeof globalThis & { thatsLifeOci?: RuntimeClients };

function value(name: string): string | undefined {
  const current = process.env[name]?.trim();
  return current || undefined;
}

/**
 * O certificado da CA pode chegar de duas formas: inline, com quebras de linha
 * escapadas, ou como caminho de arquivo. A segunda é a preferida na VM — o PEM
 * fica com leitura restrita ao serviço, fora de qualquer variável que possa
 * vazar em `env` ou em log de processo.
 */
function readSslCa(): string | undefined {
  const inline = process.env.MYSQL_SSL_CA?.replace(/\\n/g, '\n').trim();
  if (inline) return inline;

  const file = value('MYSQL_SSL_CA_FILE');
  if (!file) return undefined;
  try {
    return readFileSync(file, 'utf8');
  } catch (err) {
    // Sem o caminho no texto do erro: ele aponta para onde o segredo está.
    console.error('[oci] Não foi possível ler MYSQL_SSL_CA_FILE:', (err as NodeJS.ErrnoException).code);
    return undefined;
  }
}

function mysqlConfig(): MysqlConfig {
  const port = value('MYSQL_PORT');
  return {
    url: value('DATABASE_URL'),
    host: value('MYSQL_HOST'),
    port: port ? Number(port) : undefined,
    user: value('MYSQL_USER'),
    password: value('MYSQL_PASSWORD'),
    database: value('MYSQL_DATABASE'),
    sslCa: readSslCa(),
  };
}

export function isMysqlConfigured(): boolean {
  const config = mysqlConfig();
  return Boolean(config.url || (config.host && config.user && config.password && config.database));
}

export function getMysqlPool(): Pool {
  if (!isMysqlConfigured()) {
    throw new Error('MySQL OCI não está configurado.');
  }
  if (!globalForOci.thatsLifeOci) globalForOci.thatsLifeOci = {};
  if (globalForOci.thatsLifeOci.mysql) return globalForOci.thatsLifeOci.mysql;

  const config = mysqlConfig();
  const options: PoolOptions = config.url
    ? { uri: config.url }
    : {
        host: config.host,
        port: config.port ?? 3306,
        user: config.user,
        password: config.password,
        database: config.database,
      };

  const pool = createPool({
    ...options,
    ssl: config.sslCa ? { ca: config.sslCa, rejectUnauthorized: true } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    // O domínio trabalha com ISO 8601 em string. Deixar o driver converter
    // TIMESTAMP para `Date` faria cada mapper desfazer a conversão de volta,
    // no fuso do processo — que não é necessariamente o da organização.
    dateStrings: true,
  });

  // Com `dateStrings`, o TIMESTAMP chega como o servidor o renderiza. Fixar a
  // sessão em UTC é o que permite tratar essa string como instante absoluto;
  // sem isso, o mesmo agendamento lido de dois processos com fusos diferentes
  // produziria dois horários.
  pool.on('connection', (connection) => {
    connection.query("SET time_zone = '+00:00'");
  });

  globalForOci.thatsLifeOci.mysql = pool;
  return pool;
}

async function mysqlHealth(): Promise<Health> {
  if (!isMysqlConfigured()) return 'not_configured';
  try {
    await getMysqlPool().query('SELECT 1');
    return 'ok';
  } catch {
    return 'error';
  }
}

export async function ociRuntimeHealth(): Promise<{ mysql: Health }> {
  return { mysql: await mysqlHealth() };
}

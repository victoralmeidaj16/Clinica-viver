import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const directory = join(root, 'apps/web/.demo-state/documents');
await mkdir(directory, { recursive: true, mode: 0o700 });
const keyFile = join(directory, 'encryption.key');
try { await writeFile(keyFile, randomBytes(32).toString('hex'), { flag: 'wx', mode: 0o600 }); }
catch (error) { if (error.code !== 'EEXIST') throw error; }
const key = (await readFile(keyFile, 'utf8')).trim();
const child = spawn('npm', ['run', 'dev', '--workspace', '@thats-life/web', '--', '--port', process.env.DOCUMENTS_DEMO_PORT || '3010', '--webpack'], {
  cwd: root, stdio: 'inherit', env: {
    ...process.env, NODE_ENV: 'development', ORGANIZATION_ID: 'org-demo', NEXT_PUBLIC_ORGANIZATION_ID: 'org-demo',
    DATABASE_URL: '', MYSQL_HOST: '', MYSQL_USER: '', MYSQL_PASSWORD: '', MYSQL_DATABASE: '', BACKEND_ORIGIN: '', VERCEL: '', AUTH_USERS_JSON: '',
    AUTH_SESSION_SECRET: 'documents-local-verification', CLINICAL_DOCUMENTS_DEMO: 'true', CLINICAL_DOCUMENTS_KEY: key,
    CLINICAL_DOCUMENTS_DEMO_DIR: directory, DEMO_STATE_FILE: join(directory, 'demo-state.json'),
  },
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));

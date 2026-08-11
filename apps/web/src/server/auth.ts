import 'server-only';

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export const SESSION_COOKIE = 'viver_mais_session';
const SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface AuthSession {
  userId: string;
  organizationId: string;
  role: 'admin' | 'psicologo';
  issuedAt: number;
  expiresAt: number;
}

interface LoginUser {
  email: string;
  userId: string;
  organizationId: string;
  password?: string;
  passwordHash?: string;
}

function secret(): string {
  const configured = process.env.AUTH_SESSION_SECRET?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SESSION_SECRET é obrigatório em produção.');
  }
  return 'dev-only-change-this-session-secret';
}

function configuredUsers(): LoginUser[] {
  const raw = process.env.AUTH_USERS_JSON?.trim();
  if (raw) {
    try {
      const users = JSON.parse(raw) as unknown;
      if (Array.isArray(users)) return users as LoginUser[];
    } catch {
      throw new Error('AUTH_USERS_JSON inválido.');
    }
  }

  // Credenciais conhecidas são convenientes apenas na instalação local. Em
  // produção, esquecer de configurar autenticação precisa falhar fechado —
  // nunca transformar Admin@123 em uma senha pública da clínica.
  if (process.env.NODE_ENV === 'production') return [];

  // Credenciais de demonstração de fallback caso AUTH_USERS_JSON e DATABASE_URL não estejam definidos
  return [
    { email: 'admin@vivermais.local', password: 'Admin@123', userId: 'admin-demo', organizationId: 'org-demo' },
    { email: 'psicologo@vivermais.local', password: 'Psi@123', userId: 'user-demo', organizationId: 'org-demo' },
    { email: 'admin@vivermaispsicologia.com.br', password: 'Admin@123', userId: 'admin-demo', organizationId: 'org-demo' },
    { email: 'psicologo@vivermaispsicologia.com.br', password: 'Psi@123', userId: 'user-demo', organizationId: 'org-demo' },
  ];
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyPassword(password: string, user: LoginUser): boolean {
  if (user.passwordHash?.startsWith('scrypt$')) {
    const [, salt, expected] = user.passwordHash.split('$');
    if (!salt || !expected) return false;
    const actual = scryptSync(password, salt, 32).toString('base64url');
    return safeEqual(actual, expected);
  }
  return typeof user.password === 'string' && safeEqual(password, user.password);
}

interface DatabaseLoginRow extends RowDataPacket {
  ref_core: string;
  email_normalizado: string;
  senha_hash: string | null;
  organizacao_ref: string | null;
}

async function authenticateFromDatabase(
  normalizedEmail: string,
  password: string
): Promise<{ found: boolean; hasDatabasePassword: boolean; user: LoginUser | null }> {
  if (!isMysqlConfigured()) return { found: false, hasDatabasePassword: false, user: null };
  const [rows] = await getMysqlPool().query<DatabaseLoginRow[]>(
    `SELECT u.ref_core, u.email_normalizado, u.senha_hash, o.ref_core AS organizacao_ref
       FROM clinica_usuarios u
       LEFT JOIN clinica_membros m
         ON m.instituicao_id = u.instituicao_id AND m.usuario_ref = u.ref_core
       LEFT JOIN clinica_organizacoes o ON o.id = m.organizacao_id
      WHERE u.instituicao_id = ? AND u.email_normalizado = ?
      ORDER BY (m.status = 'active') DESC
      LIMIT 1`,
    [instituicaoId(), normalizedEmail]
  );
  const row = rows[0];
  if (!row) return { found: false, hasDatabasePassword: false, user: null };
  if (!row.senha_hash || !row.organizacao_ref) {
    return { found: true, hasDatabasePassword: Boolean(row.senha_hash), user: null };
  }
  const user: LoginUser = {
    email: row.email_normalizado,
    userId: row.ref_core,
    organizationId: row.organizacao_ref,
    passwordHash: row.senha_hash,
  };
  return { found: true, hasDatabasePassword: true, user: verifyPassword(password, user) ? user : null };
}

function encode(value: string): string {
  return Buffer.from(value).toString('base64url');
}

function decode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function serialize(session: AuthSession): string {
  const payload = encode(JSON.stringify(session));
  return `${payload}.${sign(payload)}`;
}

function deserialize(value: string): AuthSession | null {
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(decode(payload)) as AuthSession;
    if (!session.userId || !session.organizationId || !session.role || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export async function authenticate(email: string, password: string): Promise<LoginUser | null> {
  const normalizedEmail = email.trim().toLocaleLowerCase('pt-BR');
  const database = await authenticateFromDatabase(normalizedEmail, password);
  if (database.user || database.hasDatabasePassword) return database.user;
  const user = configuredUsers().find((candidate) => candidate.email.toLocaleLowerCase() === normalizedEmail);
  return user && verifyPassword(password, user) ? user : null;
}

export async function readSession(): Promise<AuthSession | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value ? deserialize(value) : null;
}

export function readSessionValue(value: string | undefined): AuthSession | null {
  return value ? deserialize(value) : null;
}

export async function startSession(user: Pick<LoginUser, 'userId' | 'organizationId'> & { role: AuthSession['role'] }): Promise<void> {
  const issuedAt = Date.now();
  const session: AuthSession = {
    userId: user.userId,
    organizationId: user.organizationId,
    role: user.role,
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS * 1000,
  };
  (await cookies()).set(SESSION_COOKIE, serialize(session), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, '', { httpOnly: true, expires: new Date(0), path: '/' });
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('base64url');
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('base64url')}`;
}

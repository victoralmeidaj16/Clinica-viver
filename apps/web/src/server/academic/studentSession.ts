import { createHmac, timingSafeEqual } from 'node:crypto';

export const STUDENT_SESSION_COOKIE = 'viver_mais_student_session';
export const STUDENT_SESSION_TTL_SECONDS = 60 * 60 * 8;

export interface StudentSession {
  studentId: string;
  institutionId: string;
  mustChangePassword: boolean;
  issuedAt: number;
  expiresAt: number;
}

interface SignedStudentSession extends StudentSession { kind: 'academic' }

function secret(): string {
  const value = process.env.AUTH_SESSION_SECRET?.trim();
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SESSION_SECRET é obrigatório em produção.');
  return 'dev-only-change-this-session-secret';
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

const encode = (value: string) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');
const sign = (payload: string) => createHmac('sha256', secret()).update(`academic:${payload}`).digest('base64url');

export function serializeStudentSession(session: StudentSession): string {
  const payload = encode(JSON.stringify({ ...session, kind: 'academic' } satisfies SignedStudentSession));
  return `${payload}.${sign(payload)}`;
}

export function readStudentSessionValue(value: string | undefined): StudentSession | null {
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
  try {
    const session = JSON.parse(decode(payload)) as SignedStudentSession;
    if (session.kind !== 'academic' || !session.studentId || !session.institutionId || session.expiresAt <= Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

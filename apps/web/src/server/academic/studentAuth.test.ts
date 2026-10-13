import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => cookieStore) }));

import type { AcademicRepository } from './academicRepository';
import { hashPassword } from '@/server/security/passwordHash';
import {
  STUDENT_SESSION_COOKIE,
  authenticateStudent,
  readStudentSessionValue,
  requireActiveStudent,
  startStudentSession,
} from './studentAuth';
import { serializeStudentSession } from './studentSession';

describe('studentAuth', () => {
  const repository = {
    findStudentCredentialByEmail: vi.fn(), getStudent: vi.fn(),
  } as unknown as AcademicRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_SESSION_SECRET = 'test-secret-with-enough-entropy';
  });

  it('autentica credencial acadêmica ativa e normaliza o e-mail', async () => {
    vi.mocked(repository.findStudentCredentialByEmail).mockResolvedValue({
      student: {
        id: 'student-1', institutionId: 'inst-1', fullName: 'Ana', email: 'ana@example.com',
        status: 'active', mustChangePassword: true, createdAt: 'now', updatedAt: 'now',
      },
      passwordHash: hashPassword('senhaForte123'),
    });
    const session = await authenticateStudent(' ANA@EXAMPLE.COM ', 'senhaForte123', repository);
    expect(repository.findStudentCredentialByEmail).toHaveBeenCalledWith('ana@example.com');
    expect(session).toMatchObject({ studentId: 'student-1', institutionId: 'inst-1', mustChangePassword: true });
  });

  it('recusa senha errada e conta desativada', async () => {
    vi.mocked(repository.findStudentCredentialByEmail).mockResolvedValue({
      student: {
        id: 'student-1', institutionId: 'inst-1', fullName: 'Ana', email: 'ana@example.com',
        status: 'disabled', mustChangePassword: false, createdAt: 'now', updatedAt: 'now',
      },
      passwordHash: hashPassword('senhaForte123'),
    });
    await expect(authenticateStudent('ana@example.com', 'senhaForte123', repository)).resolves.toBeNull();
    await expect(authenticateStudent('ana@example.com', 'errada12345', repository)).resolves.toBeNull();
  });

  it('revoga sessão emitida antes da última troca ou redefinição de senha', async () => {
    const issuedAt = Date.parse('2026-10-13T12:00:00.000Z');
    cookieStore.get.mockReturnValue({ value: serializeStudentSession({
      studentId: 'student-1', institutionId: 'inst-1', mustChangePassword: false, issuedAt, expiresAt: Date.now() + 60_000,
    }) });
    const active = {
      id: 'student-1', institutionId: 'inst-1', fullName: 'Ana', email: 'ana@example.com',
      status: 'active' as const, mustChangePassword: true, createdAt: 'now', updatedAt: 'now',
    };
    vi.mocked(repository.getStudent).mockResolvedValueOnce({ ...active, passwordChangedAt: '2026-10-13T12:00:01.000Z' });
    await expect(requireActiveStudent({ allowPasswordChange: true }, repository)).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
    vi.mocked(repository.getStudent).mockResolvedValueOnce({ ...active, passwordChangedAt: '2026-10-13T11:59:59.000Z' });
    await expect(requireActiveStudent({ allowPasswordChange: true }, repository)).resolves.toMatchObject({ id: 'student-1' });
  });

  it('usa cookie acadêmico distinto e não toca no cookie profissional', async () => {
    await startStudentSession({
      studentId: 'student-1', institutionId: 'inst-1', mustChangePassword: true,
      issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
    });
    expect(STUDENT_SESSION_COOKIE).toBe('viver_mais_student_session');
    expect(cookieStore.set).toHaveBeenCalledWith(
      'viver_mais_student_session', expect.any(String), expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
    expect(cookieStore.set).not.toHaveBeenCalledWith('viver_mais_session', expect.anything(), expect.anything());
  });

  it('rejeita assinatura alterada, expiração e payload clínico', async () => {
    await startStudentSession({
      studentId: 'student-1', institutionId: 'inst-1', mustChangePassword: false,
      issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
    });
    const value = vi.mocked(cookieStore.set).mock.calls[0][1] as string;
    expect(readStudentSessionValue(value)?.studentId).toBe('student-1');
    expect(readStudentSessionValue(`${value}alterado`)).toBeNull();
    expect(readStudentSessionValue(Buffer.from(JSON.stringify({ role: 'admin' })).toString('base64url'))).toBeNull();

    vi.setSystemTime(new Date(Date.now() + 120_000));
    expect(readStudentSessionValue(value)).toBeNull();
    vi.useRealTimers();
  });
});

import 'server-only';

import { cookies } from 'next/headers';
import type { AcademicStudent } from '@thats-life/core';
import { ApplicationError } from '@/server/application/http';
import { verifyPasswordHash } from '@/server/security/passwordHash';
import { getAcademicRepository, type AcademicRepository } from './academicRepository';
import {
  readStudentSessionValue,
  serializeStudentSession,
  STUDENT_SESSION_COOKIE,
  STUDENT_SESSION_TTL_SECONDS,
  type StudentSession,
} from './studentSession';

export { readStudentSessionValue, STUDENT_SESSION_COOKIE, type StudentSession } from './studentSession';

export async function authenticateStudent(
  email: string,
  password: string,
  repository: AcademicRepository = getAcademicRepository(),
): Promise<StudentSession | null> {
  const credential = await repository.findStudentCredentialByEmail(email.trim().toLocaleLowerCase('pt-BR'));
  if (!credential || credential.student.status !== 'active' || !verifyPasswordHash(password, credential.passwordHash)) return null;
  const issuedAt = Date.now();
  return {
    studentId: credential.student.id,
    institutionId: credential.student.institutionId,
    mustChangePassword: credential.student.mustChangePassword,
    issuedAt,
    expiresAt: issuedAt + STUDENT_SESSION_TTL_SECONDS * 1000,
  };
}

export async function readStudentSession(): Promise<StudentSession | null> {
  return readStudentSessionValue((await cookies()).get(STUDENT_SESSION_COOKIE)?.value);
}

export async function startStudentSession(session: StudentSession): Promise<void> {
  (await cookies()).set(STUDENT_SESSION_COOKIE, serializeStudentSession(session), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    maxAge: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)),
  });
}

export async function endStudentSession(): Promise<void> {
  (await cookies()).set(STUDENT_SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', expires: new Date(0), path: '/' });
}

export async function requireActiveStudent(
  options: { allowPasswordChange?: boolean } = {},
  repository: AcademicRepository = getAcademicRepository(),
): Promise<AcademicStudent> {
  const session = await readStudentSession();
  if (!session) throw new ApplicationError('UNAUTHENTICATED', 'Faça login como aluno para continuar.', 401);
  const student = await repository.getStudent(session.studentId);
  if (!student || student.institutionId !== session.institutionId || student.status !== 'active') {
    throw new ApplicationError('FORBIDDEN', 'A conta do aluno não está ativa.', 403);
  }
  // Troca ou redefinição de senha revoga toda sessão emitida antes dela; sem
  // isso, um cookie antigo sobreviveria à redefinição feita pela gestão.
  if (student.passwordChangedAt && session.issuedAt < Date.parse(student.passwordChangedAt)) {
    throw new ApplicationError('UNAUTHENTICATED', 'Sua senha foi alterada. Faça login novamente.', 401);
  }
  if (student.mustChangePassword && !options.allowPasswordChange) {
    throw new ApplicationError('PASSWORD_CHANGE_REQUIRED', 'Troque a senha temporária para continuar.', 403);
  }
  return student;
}

import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('server-only', () => ({}));

import { proxy } from './proxy';
import { serializeStudentSession, STUDENT_SESSION_COOKIE } from './server/academic/studentSession';

function studentRequest(pathname: string, mustChangePassword: boolean) {
  const cookie = serializeStudentSession({
    studentId: 'student-1', institutionId: 'inst-1', mustChangePassword, issuedAt: Date.now(), expiresAt: Date.now() + 60_000,
  });
  return new NextRequest(`http://localhost${pathname}`, { headers: { cookie: `${STUDENT_SESSION_COOKIE}=${cookie}` } });
}

describe('proxy do portal do aluno', () => {
  it('redireciona visitante sem sessão acadêmica para o login do aluno', () => {
    const response = proxy(new NextRequest('http://localhost/aluno/cursos'));
    expect(response.headers.get('location')).toBe('http://localhost/aluno/login');
  });

  it('não decide a troca de senha pela cópia do cookie, que pode estar desatualizada', () => {
    // Após uma redefinição pela gestão, o banco exige troca mas o cookie ainda diz que não:
    // o shell manda para /aluno/trocar-senha e o proxy não pode devolver para /aluno.
    expect(proxy(studentRequest('/aluno/trocar-senha', false)).headers.get('location')).toBeNull();
    expect(proxy(studentRequest('/aluno', true)).headers.get('location')).toBeNull();
  });
});

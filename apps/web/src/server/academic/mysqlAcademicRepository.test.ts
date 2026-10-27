import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'mysql2/promise';

vi.mock('server-only', () => ({}));

const { query, execute } = vi.hoisted(() => ({
  query: vi.fn(async () => [[], []]),
  execute: vi.fn(async () => [{ affectedRows: 1 }, []]),
}));

import { MysqlAcademicRepository } from './mysqlAcademicRepository';

describe('MysqlAcademicRepository', () => {
  const repository = new MysqlAcademicRepository({ query, execute } as unknown as Pool, 'inst-1');

  beforeEach(() => vi.clearAllMocks());

  it('aplica instituicao_id em toda leitura e escrita', async () => {
    await repository.listStudents();
    await repository.listCoursesForManagement();
    await repository.completeLesson('student-1', 'lesson-1', '2026-10-13T12:00:00.000Z');

    for (const call of [...query.mock.calls, ...execute.mock.calls]) {
      const [sql, values] = call as unknown as [string, unknown[]];
      expect(sql).toContain('instituicao_id');
      expect(values).toContain('inst-1');
    }
  });

  it('edição do perfil não sobrescreve e-mail nem reativa conta desativada', async () => {
    await repository.updateStudentProfile('student-1', 'Aluno', '11999999999', '2026-10-13T12:00:00.000Z');
    const [sql] = execute.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).not.toContain('email_normalizado =');
    expect(sql).not.toContain('status = ?');
    expect(sql).toContain("status = 'active'");
  });

  it('mapeia a árvore curso > módulos > aulas na ordem persistida', async () => {
    query
      .mockResolvedValueOnce([[{
        id: 2, nome: 'Psicodrama', descricao: 'Descrição', capa_url: null,
        ordem: 1, ativo: 1, publicado: 1,
      }], []] as never)
      .mockResolvedValueOnce([[
        { id: 'module-2', curso_id: 2, titulo: 'Segundo', ordem: 2 },
        { id: 'module-1', curso_id: 2, titulo: 'Primeiro', ordem: 1 },
      ], []] as never)
      .mockResolvedValueOnce([[
        { id: 'lesson-1', modulo_id: 'module-1', titulo: 'Aula 1', descricao: null, duracao_min: 12, vimeo_id: '123', vimeo_hash: 'abc123', ordem: 1, publicado: 1 },
      ], []] as never);

    const tree = await repository.getCourseTree('2');

    expect(tree?.modules.map((module) => module.id)).toEqual(['module-1', 'module-2']);
    expect(tree?.modules[0].lessons[0]).toMatchObject({ id: 'lesson-1', courseId: '2', modulePosition: 1, vimeoHash: 'abc123' });
  });

  it('mapeia e persiste os metadados exclusivos do certificado', async () => {
    query.mockResolvedValueOnce([[
      { id: 9, nome: 'Curso especial', descricao: '', capa_url: null, professor_certificado: 'Professora',
        duracao_certificado_min: 90, modelo_texto_certificado: 'online-course-with-instructor', ordem: 1, ativo: 1, publicado: 1 },
    ], []] as never);
    await expect(repository.listCoursesForManagement()).resolves.toEqual([
      expect.objectContaining({ certificateTextModel: 'online-course-with-instructor', certificateInstructor: 'Professora', certificateDurationMinutes: 90 }),
    ]);

    await repository.saveCourse({
      id: '9', institutionId: 'inst-1', title: 'Curso especial', description: '', position: 1, active: true, published: true,
      certificateTextModel: 'online-course-with-instructor', certificateInstructor: 'Professora', certificateDurationMinutes: 90,
    });
    const [sql, values] = execute.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('professor_certificado = ?');
    expect(sql).toContain('modelo_texto_certificado = ?');
    expect(values).toEqual(expect.arrayContaining(['Professora', 90, 'online-course-with-instructor']));
  });

  it('persiste o hash do Vimeo e a data da troca de senha', async () => {
    await repository.saveLesson({
      id: 'lesson-1', courseId: '2', moduleId: 'module-1', modulePosition: 1, title: 'Aula', durationMinutes: 10,
      position: 1, vimeoId: '123', vimeoHash: 'abc123', published: true,
    });
    await repository.updateStudentPassword('student-1', 'scrypt$x', false, '2026-10-13T12:00:00.000Z');
    const [lessonSql, lessonValues] = execute.mock.calls[0] as unknown as [string, unknown[]];
    const [passwordSql, passwordValues] = execute.mock.calls[1] as unknown as [string, unknown[]];
    expect(lessonSql).toContain('vimeo_hash = VALUES(vimeo_hash)');
    expect(lessonValues).toContain('abc123');
    expect(passwordSql).toContain('senha_alterada_em = ?');
    expect(passwordValues).toContain('2026-10-13 12:00:00.000');
  });

  it('grava e lê instantes no formato TIMESTAMP em UTC do pool', async () => {
    await repository.completeLesson('student-1', 'lesson-1', '2026-10-13T12:00:00.000Z');
    expect((execute.mock.calls[0] as unknown as [string, unknown[]])[1]).toContain('2026-10-13 12:00:00.000');
    query.mockResolvedValueOnce([[{ aluno_id: 'student-1', aula_id: 'lesson-1', concluida_em: '2026-10-13 12:00:00.000' }], []] as never);
    expect((await repository.listCompletions('student-1'))[0].completedAt).toBe('2026-10-13T12:00:00.000Z');
  });

  it('nunca envia ISO com Z para colunas TIMESTAMP ao gravar aluno e matrícula', async () => {
    const at = '2026-10-13T12:00:00.000Z';
    await repository.insertStudent({
      id: 'student-1', institutionId: 'inst-1', fullName: 'Aluno', email: 'aluno@example.invalid',
      status: 'active', mustChangePassword: true, createdAt: at, updatedAt: at,
    }, 'scrypt$x', 'admin-1');
    await repository.updateStudent({
      id: 'student-1', institutionId: 'inst-1', fullName: 'Aluno', email: 'aluno@example.invalid',
      status: 'active', mustChangePassword: false, createdAt: at, updatedAt: at,
    });
    await repository.saveEnrollment({ id: 'enr-1', studentId: 'student-1', courseId: '2', status: 'active', createdAt: at, updatedAt: at });
    for (const call of execute.mock.calls) {
      const values = (call as unknown as [string, unknown[]])[1];
      expect(values).not.toContain(at);
      expect(values).toContain('2026-10-13 12:00:00.000');
    }
  });

  it('lista para o aluno somente matrícula ativa e conteúdo ativo/publicado', async () => {
    await repository.listStudentCourses('student-1');
    const [sql, values] = query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("mat.status = 'active'");
    expect(sql).toContain('curso.ativo = 1');
    expect(sql).toContain('curso.publicado = 1');
    expect(values).toEqual(['inst-1', 'student-1']);
  });

  it('usa INSERT IGNORE para tornar a conclusão idempotente', async () => {
    await repository.completeLesson('student-1', 'lesson-1', '2026-10-13T12:00:00.000Z');
    const [sql, values] = execute.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('INSERT IGNORE INTO clinica_aluno_progresso_aulas');
    expect(values).toEqual(expect.arrayContaining(['inst-1', 'student-1', 'lesson-1']));
  });

  it('suspende matrícula sem apagar as conclusões', async () => {
    await repository.saveEnrollment({
      id: 'enrollment-1', studentId: 'student-1', courseId: '2', status: 'suspended',
      createdAt: '2026-10-13T12:00:00.000Z', updatedAt: '2026-10-13T12:00:00.000Z',
    });
    const [sql] = execute.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('INSERT INTO clinica_aluno_matriculas');
    expect(sql).toContain('ON DUPLICATE KEY UPDATE status = VALUES(status)');
    expect(sql).not.toContain('DELETE');
  });
});

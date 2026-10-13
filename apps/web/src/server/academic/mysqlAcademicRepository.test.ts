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
        { id: 'lesson-1', modulo_id: 'module-1', titulo: 'Aula 1', descricao: null, duracao_min: 12, vimeo_id: '123', ordem: 1, publicado: 1 },
      ], []] as never);

    const tree = await repository.getCourseTree('2');

    expect(tree?.modules.map((module) => module.id)).toEqual(['module-1', 'module-2']);
    expect(tree?.modules[0].lessons[0]).toMatchObject({ id: 'lesson-1', courseId: '2', modulePosition: 1 });
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

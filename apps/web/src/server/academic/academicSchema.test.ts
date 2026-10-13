import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), '../../infra/mysql/053_portal_aluno.sql');

describe('migração do portal do aluno', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  it.each([
    'clinica_alunos',
    'clinica_aluno_matriculas',
    'clinica_cursos_modulos',
    'clinica_cursos_aulas',
    'clinica_aluno_progresso_aulas',
  ])('cria a tabela %s', (table) => {
    expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
  });

  it('amplia o catálogo de cursos com apresentação e publicação', () => {
    for (const column of ['descricao', 'capa_url', 'ordem', 'publicado']) {
      expect(sql).toContain(`column_name = '${column}'`);
    }
  });

  it('isola identidade acadêmica e impede duplicidades acadêmicas', () => {
    const studentTable = sql.slice(sql.indexOf('CREATE TABLE IF NOT EXISTS clinica_alunos'), sql.indexOf('CREATE TABLE IF NOT EXISTS clinica_aluno_matriculas'));
    expect(studentTable).not.toContain('REFERENCES clinica_usuarios');
    expect(studentTable).toContain('UNIQUE KEY clinica_alunos_email_uq (instituicao_id, email_normalizado)');
    expect(sql).toContain('UNIQUE KEY clinica_aluno_matriculas_uq (instituicao_id, aluno_id, curso_id)');
    expect(sql).toContain('UNIQUE KEY clinica_aluno_progresso_uq (instituicao_id, aluno_id, aula_id)');
  });
});

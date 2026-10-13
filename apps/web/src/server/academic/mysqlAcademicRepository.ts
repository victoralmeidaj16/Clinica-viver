import 'server-only';

import { randomUUID } from 'node:crypto';
import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type {
  AcademicCourse,
  AcademicCourseTree,
  AcademicEnrollment,
  AcademicLesson,
  AcademicModule,
  AcademicStudent,
  LessonCompletion,
} from '@thats-life/core';
import { getMysqlPool } from '@/server/oci/runtime';
import { fromSqlTimestamp, toSqlTimestamp } from '@/server/persistence/mysql/mappers';
import type { AcademicRepository, StudentCredential, StudentLessonAccess } from './academicRepository';

type Row = RowDataPacket & Record<string, unknown>;

const text = (value: unknown) => String(value ?? '');
const optional = (value: unknown) => value == null || value === '' ? undefined : String(value);
const iso = (value: unknown) => fromSqlTimestamp(value as string | Date | null) ?? '';

function mapStudent(row: Row): AcademicStudent {
  return {
    id: text(row.id), institutionId: text(row.instituicao_id), fullName: text(row.nome_completo),
    email: text(row.email_normalizado), phone: optional(row.telefone),
    status: row.status === 'disabled' ? 'disabled' : 'active',
    mustChangePassword: Boolean(row.troca_senha_obrigatoria),
    passwordChangedAt: row.senha_alterada_em == null ? undefined : iso(row.senha_alterada_em),
    createdAt: iso(row.criado_em), updatedAt: iso(row.atualizado_em),
  };
}

function mapCourse(row: Row, institutionId: string): AcademicCourse {
  return {
    id: text(row.id), institutionId, title: text(row.nome), description: text(row.descricao),
    coverUrl: optional(row.capa_url), position: Number(row.ordem ?? 0),
    active: Boolean(row.ativo), published: Boolean(row.publicado),
  };
}

function mapModule(row: Row): AcademicModule {
  return { id: text(row.id), courseId: text(row.curso_id), title: text(row.titulo), position: Number(row.ordem ?? 0) };
}

function mapLesson(row: Row, courseId: string, modulePosition: number): AcademicLesson {
  return {
    id: text(row.id), courseId, moduleId: text(row.modulo_id), modulePosition,
    title: text(row.titulo), description: optional(row.descricao), durationMinutes: Number(row.duracao_min ?? 0),
    position: Number(row.ordem ?? 0), vimeoId: text(row.vimeo_id), vimeoHash: optional(row.vimeo_hash),
    published: Boolean(row.publicado),
  };
}

export class MysqlAcademicRepository implements AcademicRepository {
  constructor(private readonly pool: Pool = getMysqlPool(), private readonly institutionId: string) {}

  async findStudentCredentialByEmail(email: string): Promise<StudentCredential | null> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT * FROM clinica_alunos WHERE instituicao_id = ? AND email_normalizado = ? LIMIT 1`,
      [this.institutionId, email],
    );
    return rows[0] ? { student: mapStudent(rows[0]), passwordHash: text(rows[0].senha_hash) } : null;
  }

  async getStudent(studentId: string): Promise<AcademicStudent | null> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT id, instituicao_id, nome_completo, email_normalizado, telefone, status,
              troca_senha_obrigatoria, senha_alterada_em, criado_em, atualizado_em
         FROM clinica_alunos WHERE instituicao_id = ? AND id = ? LIMIT 1`,
      [this.institutionId, studentId],
    );
    return rows[0] ? mapStudent(rows[0]) : null;
  }

  async listStudents(): Promise<AcademicStudent[]> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT id, instituicao_id, nome_completo, email_normalizado, telefone, status,
              troca_senha_obrigatoria, senha_alterada_em, criado_em, atualizado_em
         FROM clinica_alunos WHERE instituicao_id = ? ORDER BY nome_completo`,
      [this.institutionId],
    );
    return rows.map(mapStudent);
  }

  async insertStudent(student: AcademicStudent, passwordHash: string, actorUserId: string): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_alunos
        (id, instituicao_id, nome_completo, email_normalizado, telefone, senha_hash,
         troca_senha_obrigatoria, status, criado_por, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student.id, this.institutionId, student.fullName, student.email, student.phone ?? null, passwordHash,
        student.mustChangePassword ? 1 : 0, student.status, actorUserId, student.createdAt, student.updatedAt],
    );
  }

  async updateStudent(student: AcademicStudent): Promise<void> {
    await this.pool.execute(
      `UPDATE clinica_alunos SET nome_completo = ?, email_normalizado = ?, telefone = ?, status = ?, atualizado_em = ?
        WHERE instituicao_id = ? AND id = ?`,
      [student.fullName, student.email, student.phone ?? null, student.status, student.updatedAt, this.institutionId, student.id],
    );
  }

  async updateStudentPassword(
    studentId: string, passwordHash: string, mustChangePassword: boolean, changedAt: string, actorUserId?: string,
  ): Promise<void> {
    await this.pool.execute(
      `UPDATE clinica_alunos SET senha_hash = ?, troca_senha_obrigatoria = ?, senha_redefinida_por = ?,
              senha_alterada_em = ?, atualizado_em = CURRENT_TIMESTAMP(3)
        WHERE instituicao_id = ? AND id = ?`,
      [passwordHash, mustChangePassword ? 1 : 0, actorUserId ?? null, toSqlTimestamp(changedAt), this.institutionId, studentId],
    );
  }

  async listCoursesForManagement(): Promise<AcademicCourse[]> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT id, nome, descricao, capa_url, ordem, ativo, publicado
         FROM clinica_cursos_pos_graduacao WHERE instituicao_id = ? ORDER BY ordem, nome`,
      [this.institutionId],
    );
    return rows.map((row) => mapCourse(row, this.institutionId));
  }

  async getCourseTree(courseId: string): Promise<AcademicCourseTree | null> {
    const [courseRows] = await this.pool.query<Row[]>(
      `SELECT id, nome, descricao, capa_url, ordem, ativo, publicado
         FROM clinica_cursos_pos_graduacao WHERE instituicao_id = ? AND id = ? LIMIT 1`,
      [this.institutionId, courseId],
    );
    if (!courseRows[0]) return null;
    const [moduleRows] = await this.pool.query<Row[]>(
      `SELECT id, curso_id, titulo, ordem FROM clinica_cursos_modulos
        WHERE instituicao_id = ? AND curso_id = ? ORDER BY ordem, titulo`,
      [this.institutionId, courseId],
    );
    const [lessonRows] = await this.pool.query<Row[]>(
      `SELECT aula.id, aula.modulo_id, aula.titulo, aula.descricao, aula.duracao_min,
              aula.vimeo_id, aula.vimeo_hash, aula.ordem, aula.publicado
         FROM clinica_cursos_aulas aula
         JOIN clinica_cursos_modulos modulo ON modulo.id = aula.modulo_id AND modulo.instituicao_id = aula.instituicao_id
        WHERE aula.instituicao_id = ? AND modulo.curso_id = ?
        ORDER BY modulo.ordem, aula.ordem`,
      [this.institutionId, courseId],
    );
    const modules = moduleRows.map(mapModule).sort((a, b) => a.position - b.position);
    return {
      ...mapCourse(courseRows[0], this.institutionId),
      modules: modules.map((module) => ({
        ...module,
        lessons: lessonRows
          .filter((row) => text(row.modulo_id) === module.id)
          .map((row) => mapLesson(row, courseId, module.position))
          .sort((a, b) => a.position - b.position),
      })),
    };
  }

  async saveCourse(course: AcademicCourse): Promise<AcademicCourse> {
    if (!course.id) {
      const [result] = await this.pool.execute<ResultSetHeader>(
        `INSERT INTO clinica_cursos_pos_graduacao
          (instituicao_id, nome, descricao, capa_url, ordem, ativo, publicado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [this.institutionId, course.title, course.description, course.coverUrl ?? null, course.position, course.active ? 1 : 0, course.published ? 1 : 0],
      );
      return { ...course, id: String(result.insertId) };
    }
    await this.pool.execute(
      `UPDATE clinica_cursos_pos_graduacao
          SET nome = ?, descricao = ?, capa_url = ?, ordem = ?, ativo = ?, publicado = ?
        WHERE instituicao_id = ? AND id = ?`,
      [course.title, course.description, course.coverUrl ?? null, course.position, course.active ? 1 : 0,
        course.published ? 1 : 0, this.institutionId, course.id],
    );
    return course;
  }

  async saveModule(module: AcademicModule): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_cursos_modulos (id, instituicao_id, curso_id, titulo, ordem)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), ordem = VALUES(ordem)`,
      [module.id, this.institutionId, module.courseId, module.title, module.position],
    );
  }

  async saveLesson(lesson: AcademicLesson): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_cursos_aulas
        (id, instituicao_id, modulo_id, titulo, descricao, duracao_min, vimeo_id, vimeo_hash, ordem, publicado)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE titulo = VALUES(titulo), descricao = VALUES(descricao), duracao_min = VALUES(duracao_min),
         vimeo_id = VALUES(vimeo_id), vimeo_hash = VALUES(vimeo_hash), ordem = VALUES(ordem), publicado = VALUES(publicado)`,
      [lesson.id, this.institutionId, lesson.moduleId, lesson.title, lesson.description ?? null,
        lesson.durationMinutes, lesson.vimeoId, lesson.vimeoHash ?? null, lesson.position, lesson.published ? 1 : 0],
    );
  }

  async listEnrollments(studentId?: string): Promise<AcademicEnrollment[]> {
    const values: unknown[] = [this.institutionId];
    const filter = studentId ? ' AND aluno_id = ?' : '';
    if (studentId) values.push(studentId);
    const [rows] = await this.pool.query<Row[]>(
      `SELECT id, aluno_id, curso_id, status, criado_em, atualizado_em
         FROM clinica_aluno_matriculas WHERE instituicao_id = ?${filter} ORDER BY criado_em DESC`, values,
    );
    return rows.map((row) => ({
      id: text(row.id), studentId: text(row.aluno_id), courseId: text(row.curso_id),
      status: row.status === 'suspended' ? 'suspended' : 'active', createdAt: iso(row.criado_em), updatedAt: iso(row.atualizado_em),
    }));
  }

  async saveEnrollment(enrollment: AcademicEnrollment): Promise<void> {
    await this.pool.execute(
      `INSERT INTO clinica_aluno_matriculas
        (id, instituicao_id, aluno_id, curso_id, status, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), atualizado_em = VALUES(atualizado_em)`,
      [enrollment.id, this.institutionId, enrollment.studentId, enrollment.courseId, enrollment.status,
        enrollment.createdAt, enrollment.updatedAt],
    );
  }

  async listStudentCourses(studentId: string): Promise<AcademicCourse[]> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT curso.id, curso.nome, curso.descricao, curso.capa_url, curso.ordem, curso.ativo, curso.publicado
         FROM clinica_aluno_matriculas mat
         JOIN clinica_cursos_pos_graduacao curso ON curso.id = mat.curso_id AND curso.instituicao_id = mat.instituicao_id
        WHERE mat.instituicao_id = ? AND mat.aluno_id = ? AND mat.status = 'active'
          AND curso.ativo = 1 AND curso.publicado = 1
        ORDER BY curso.ordem, curso.nome`,
      [this.institutionId, studentId],
    );
    return rows.map((row) => mapCourse(row, this.institutionId));
  }

  async getStudentLesson(studentId: string, lessonId: string): Promise<StudentLessonAccess | null> {
    const [rows] = await this.pool.query<Row[]>(
      `SELECT aula.id AS aula_id, aula.titulo AS aula_titulo, aula.descricao AS aula_descricao,
              aula.duracao_min, aula.vimeo_id, aula.vimeo_hash, aula.ordem AS aula_ordem, aula.publicado AS aula_publicado,
              modulo.id AS modulo_id, modulo.titulo AS modulo_titulo, modulo.ordem AS modulo_ordem,
              curso.id AS curso_id, curso.nome, curso.descricao, curso.capa_url, curso.ordem AS curso_ordem,
              curso.ativo, curso.publicado AS curso_publicado,
              mat.id AS matricula_id, mat.status AS matricula_status, mat.criado_em AS matricula_criada_em,
              mat.atualizado_em AS matricula_atualizada_em
         FROM clinica_cursos_aulas aula
         JOIN clinica_cursos_modulos modulo ON modulo.id = aula.modulo_id AND modulo.instituicao_id = aula.instituicao_id
         JOIN clinica_cursos_pos_graduacao curso ON curso.id = modulo.curso_id AND curso.instituicao_id = aula.instituicao_id
         JOIN clinica_aluno_matriculas mat ON mat.curso_id = curso.id AND mat.instituicao_id = aula.instituicao_id
        WHERE aula.instituicao_id = ? AND mat.aluno_id = ? AND aula.id = ?
          AND mat.status = 'active' AND curso.ativo = 1 AND curso.publicado = 1 AND aula.publicado = 1 LIMIT 1`,
      [this.institutionId, studentId, lessonId],
    );
    const row = rows[0];
    if (!row) return null;
    const course = mapCourse({ ...row, id: row.curso_id, ordem: row.curso_ordem, publicado: row.curso_publicado } as Row, this.institutionId);
    const academicModule = mapModule({ id: row.modulo_id, curso_id: row.curso_id, titulo: row.modulo_titulo, ordem: row.modulo_ordem } as Row);
    const lesson = mapLesson({
      id: row.aula_id, modulo_id: row.modulo_id, titulo: row.aula_titulo, descricao: row.aula_descricao,
      duracao_min: row.duracao_min, vimeo_id: row.vimeo_id, vimeo_hash: row.vimeo_hash, ordem: row.aula_ordem, publicado: row.aula_publicado,
    } as Row, course.id, academicModule.position);
    return {
      course, module: academicModule, lesson,
      enrollment: {
        id: text(row.matricula_id), studentId, courseId: course.id, status: 'active',
        createdAt: iso(row.matricula_criada_em), updatedAt: iso(row.matricula_atualizada_em),
      },
    };
  }

  async listCompletions(studentId: string, courseId?: string): Promise<LessonCompletion[]> {
    const values: unknown[] = [this.institutionId, studentId];
    const courseFilter = courseId ? ' AND modulo.curso_id = ?' : '';
    if (courseId) values.push(courseId);
    const [rows] = await this.pool.query<Row[]>(
      `SELECT progresso.aluno_id, progresso.aula_id, progresso.concluida_em
         FROM clinica_aluno_progresso_aulas progresso
         JOIN clinica_cursos_aulas aula ON aula.id = progresso.aula_id AND aula.instituicao_id = progresso.instituicao_id
         JOIN clinica_cursos_modulos modulo ON modulo.id = aula.modulo_id AND modulo.instituicao_id = aula.instituicao_id
        WHERE progresso.instituicao_id = ? AND progresso.aluno_id = ?${courseFilter}
        ORDER BY progresso.concluida_em`, values,
    );
    return rows.map((row) => ({ studentId: text(row.aluno_id), lessonId: text(row.aula_id), completedAt: iso(row.concluida_em) }));
  }

  async completeLesson(studentId: string, lessonId: string, completedAt: string): Promise<void> {
    await this.pool.execute(
      `INSERT IGNORE INTO clinica_aluno_progresso_aulas
        (id, instituicao_id, aluno_id, aula_id, concluida_em)
       VALUES (?, ?, ?, ?, ?)`,
      [randomUUID(), this.institutionId, studentId, lessonId, toSqlTimestamp(completedAt)],
    );
  }
}

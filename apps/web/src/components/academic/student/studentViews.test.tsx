import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { StudentCourseView } from '@/server/academic/studentPortalService';
import { StudentLoginForm } from './StudentLoginForm';
import { StudentNavigation } from './StudentShell';
import { StudentDashboardView } from './StudentDashboard';
import { CourseGrid } from './CourseGrid';
import { CourseDetailView } from './CourseDetail';
import { PasswordForm, StudentAccountForm } from './StudentAccount';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));

const course: StudentCourseView = {
  id: 'course-1', institutionId: 'institution-1', title: 'Fundamentos da prática clínica',
  description: 'Um percurso de introdução.', position: 1, active: true, published: true,
  progress: { completed: 1, total: 3, percentage: 33 },
  nextLesson: { id: 'lesson-2', courseId: 'course-1', moduleId: 'module-1', modulePosition: 1, title: 'Escuta ativa', durationMinutes: 18, position: 2, vimeoId: '123', published: true },
  modules: [{ id: 'module-1', courseId: 'course-1', title: 'Primeiros passos', position: 1, lessons: [
    { id: 'lesson-1', courseId: 'course-1', moduleId: 'module-1', modulePosition: 1, title: 'Boas-vindas', durationMinutes: 8, position: 1, vimeoId: '122', published: true },
    { id: 'lesson-2', courseId: 'course-1', moduleId: 'module-1', modulePosition: 1, title: 'Escuta ativa', durationMinutes: 18, position: 2, vimeoId: '123', published: true },
  ] }],
};

describe('portal visual do aluno', () => {
  it('identifica o ambiente exclusivo do aluno no login', () => {
    const html = renderToStaticMarkup(<StudentLoginForm />);
    expect(html).toContain('Portal do Aluno');
    expect(html).toContain('seus cursos');
  });

  it('mostra continuação e progresso calculado pelo servidor', () => {
    const html = renderToStaticMarkup(<StudentDashboardView studentName="Ana" courses={[course]} />);
    expect(html).toContain('Continuar estudando');
    expect(html).toContain('33%');
    expect(html).toContain('1 de 3 aulas');
  });

  it('explicita quando ainda não há matrícula', () => {
    expect(renderToStaticMarkup(<CourseGrid courses={[]} />)).toContain('Nenhum curso liberado');
  });

  it('preserva a ordem de módulos e aulas no detalhe', () => {
    const html = renderToStaticMarkup(<CourseDetailView course={course} />);
    expect(html.indexOf('Boas-vindas')).toBeLessThan(html.indexOf('Escuta ativa'));
  });

  it('mantém a navegação livre de áreas clínicas e de gestão', () => {
    const html = renderToStaticMarkup(<StudentNavigation pathname="/aluno" onLogout={() => undefined} />);
    expect(html).toContain('Visão geral');
    expect(html).toContain('Cursos e aulas');
    expect(html).toContain('Minha conta');
    expect(html).not.toContain('Pacientes');
    expect(html).not.toContain('Gestão');
  });

  it('limita a conta aos dados editáveis pelo aluno', () => {
    const html = renderToStaticMarkup(<StudentAccountForm student={{ fullName: 'Ana Lima', email: 'ana@example.com', phone: '' }} />);
    expect(html).toContain('Nome completo');
    expect(html).toContain('Telefone');
    expect(html).not.toContain('Perfil de acesso');
    expect(html).not.toContain('Status da conta');
  });

  it('pede a senha atual para a troca voluntária de senha', () => {
    const html = renderToStaticMarkup(<PasswordForm />);
    expect(html).toContain('Senha atual');
    expect(html).toContain('autoComplete="current-password"');
  });
});

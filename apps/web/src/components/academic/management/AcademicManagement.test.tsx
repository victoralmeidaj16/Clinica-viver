import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AcademicManagement } from './AcademicManagement';
import { StudentForm } from './StudentForm';
import { CourseEditor } from './CourseEditor';
import { LessonEditor } from './LessonEditor';
import { ModuleEditor } from './ModuleEditor';
import { ConfirmPrompt } from './ConfirmButton';

describe('gestão acadêmica', () => {
  it('apresenta as três áreas de trabalho', () => {
    const html = renderToStaticMarkup(<AcademicManagement />);
    expect(html).toContain('Alunos');
    expect(html).toContain('Cursos e aulas');
    expect(html).toContain('Matrículas');
  });

  it('explica a senha temporária sem exibir dados clínicos', () => {
    const html = renderToStaticMarkup(<StudentForm onSaved={() => undefined} />);
    expect(html).toContain('Senha temporária');
    expect(html).toContain('troca no primeiro acesso');
    expect(html).not.toContain('Prontuário');
    expect(html).not.toContain('Paciente');
  });

  it('distingue curso publicado e aula exclusiva Vimeo', () => {
    const courseHtml = renderToStaticMarkup(<CourseEditor onSaved={() => undefined} />);
    const lessonHtml = renderToStaticMarkup(<LessonEditor courseId="2" moduleId="module-1" modulePosition={1} onSaved={() => undefined} />);
    expect(courseHtml).toContain('Publicar no portal');
    expect(lessonHtml).toContain('Link ou ID do Vimeo');
    expect(lessonHtml).not.toContain('YouTube');
  });

  it('edita aula existente preservando o link Vimeo com hash', () => {
    const html = renderToStaticMarkup(<LessonEditor courseId="2" moduleId="module-1" modulePosition={1} onSaved={() => undefined} lesson={{
      id: 'lesson-1', courseId: '2', moduleId: 'module-1', modulePosition: 1, title: 'Acolhimento', durationMinutes: 20,
      position: 3, vimeoId: '123', vimeoHash: 'abc123', published: true,
    }} />);
    expect(html).toContain('value="Acolhimento"');
    expect(html).toContain('value="https://vimeo.com/123/abc123"');
    expect(html).toContain('Salvar aula');
    expect(html).not.toContain('Adicionar aula');
  });

  it('renomeia módulo existente', () => {
    const html = renderToStaticMarkup(<ModuleEditor courseId="2" nextPosition={2} onSaved={() => undefined} module={{ id: 'module-1', courseId: '2', title: 'Fundamentos', position: 1 }} />);
    expect(html).toContain('value="Fundamentos"');
    expect(html).toContain('Salvar módulo');
  });

  it('pede confirmação explícita antes de ação destrutiva', () => {
    const html = renderToStaticMarkup(<ConfirmPrompt message="Suspender a matrícula de Ana?" onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('Suspender a matrícula de Ana?');
    expect(html).toContain('Confirmar');
    expect(html).toContain('Cancelar');
  });
});

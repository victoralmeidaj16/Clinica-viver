import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AcademicManagement } from './AcademicManagement';
import { StudentForm } from './StudentForm';
import { CourseEditor } from './CourseEditor';
import { LessonEditor } from './LessonEditor';

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
});

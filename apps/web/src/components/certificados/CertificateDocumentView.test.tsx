import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CertificateRecord } from '@thats-life/core';
import { CertificateDocumentView } from './CertificateDocumentView';

const base: CertificateRecord = {
  id: 'VM-TEST', code: 'VM-TEST', studentName: 'Ana Beatriz', courseTitle: 'Curso de Teste',
  durationHours: '1h', issueDate: '14/10/2026', status: 'valid', createdAt: '2026-10-14T12:00:00.000Z',
};

describe('CertificateDocumentView', () => {
  it('usa a redação exclusiva no layout atual do certificado especial', () => {
    const html = renderToStaticMarkup(<CertificateDocumentView record={{
      ...base, certificateTextModel: 'online-course-with-instructor',
      certificateInstructor: 'Esp. Jaqueline Batista Silva Taufembach', certificateDurationMinutes: 90,
    }} publicValidationUrl="https://example.com/validar/VM-TEST" />);
    expect(html).toContain('ministrado pela Esp. Jaqueline Batista Silva Taufembach');
    expect(html).toContain('com duração de 1 hora e 30 minutos');
    expect(html).toContain('modalidade online');
  });

  it('preserva a redação atual para certificados comuns', () => {
    const html = renderToStaticMarkup(<CertificateDocumentView record={{ ...base, certificateTextModel: 'standard' }} publicValidationUrl="https://example.com/validar/VM-TEST" />);
    expect(html).toContain('Certificamos oficialmente que');
    expect(html).not.toContain('ministrado pela');
  });

  it('ignora a arte gravada nos cursos online com ministrante e usa o layout da marca', () => {
    const html = renderToStaticMarkup(<CertificateDocumentView record={{
      ...base, certificateTextModel: 'online-course-with-instructor',
      certificateInstructor: 'Esp. Jaqueline Batista Silva Taufembach', certificateDurationMinutes: 90,
      frontImageUrl: 'data:image/png;base64,AAAA', backImageUrl: 'data:image/png;base64,BBBB',
    }} publicValidationUrl="https://example.com/validar/VM-TEST" />);
    expect(html).not.toContain('data:image/png');
    expect(html).toContain('/logo-viver-mais-white.png');
  });
});

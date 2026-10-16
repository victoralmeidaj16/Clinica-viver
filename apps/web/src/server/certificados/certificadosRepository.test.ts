import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { CertificadosRepository } from './certificadosRepository';

describe('CertificadosRepository', () => {
  it('não deve disponibilizar certificados fictícios removidos', async () => {
    const repo = new CertificadosRepository();
    await expect(repo.porCodigo('yZV8anjS')).resolves.toBeNull();
    await expect(repo.porCodigo('VVR-DEMO-2026')).resolves.toBeNull();
    await expect(repo.porCodigo('VVR-TEST-3390')).resolves.toBeNull();
  });

  it('deve emitir novo certificado e torná-lo consultável', async () => {
    const repo = new CertificadosRepository();
    const emitido = await repo.emitir({
      studentName: 'Lucas Oliveira',
      courseTitle: 'Neuropsicologia Clínica',
      durationHours: '180h',
      issueDate: '24/08/2026',
    });

    expect(emitido.code).toBeDefined();
    expect(emitido.code).toHaveLength(8);

    const consultado = await repo.porCodigo(emitido.code);
    expect(consultado).not.toBeNull();
    expect(consultado?.studentName).toBe('Lucas Oliveira');
    expect(consultado?.status).toBe('valid');
  });

  it('deve atualizar o status de um certificado para revogado com motivo', async () => {
    const repo = new CertificadosRepository();
    const emitido = await repo.emitir({
      studentName: 'Beatriz Costa',
      courseTitle: 'Psicanálise Clínica',
      durationHours: '60h',
      issueDate: '24/08/2026',
    });

    const sucesso = await repo.atualizarStatus(
      emitido.code,
      'revoked',
      'Cancelamento de matrícula solicitado pelo aluno'
    );
    expect(sucesso).toBe(true);

    const consultado = await repo.porCodigo(emitido.code);
    expect(consultado?.status).toBe('revoked');
    expect(consultado?.revocationReason).toBe('Cancelamento de matrícula solicitado pelo aluno');
  });

  it('deve emitir certificado com QR code da frente e preservar configurações', async () => {
    const repo = new CertificadosRepository();
    const emitido = await repo.emitir({
      studentName: 'Mariana Souza',
      courseTitle: 'Psicologia Hospitalar',
      durationHours: '360h',
      issueDate: '22/09/2026',
      frontQrEnabled: true,
      frontQrX: 81.5,
      frontQrY: 68.5,
      frontQrSize: 8.5,
    });

    expect(emitido.frontQrEnabled).toBe(true);
    expect(emitido.frontQrX).toBe(81.5);
    expect(emitido.frontQrY).toBe(68.5);
    expect(emitido.frontQrSize).toBe(8.5);

    const consultado = await repo.porCodigo(emitido.code);
    expect(consultado).not.toBeNull();
    expect(consultado?.frontQrEnabled).toBe(true);
    expect(consultado?.frontQrX).toBe(81.5);
    expect(consultado?.frontQrY).toBe(68.5);
    expect(consultado?.frontQrSize).toBe(8.5);
  });

  it('emite automaticamente uma única vez por instituição, aluno e curso', async () => {
    const repo = new CertificadosRepository();
    const input = {
      institutionId: 'inst-auto-1', studentId: 'student-auto-1', courseId: 'course-auto-1',
      studentName: 'Ana Aluna', studentEmail: 'ana@example.com', courseTitle: 'Formação Clínica',
      durationHours: '10h', issueDate: '14/10/2026', startDate: '2026-09-01', completionDate: '2026-10-14',
    };
    const first = await repo.emitirAutomatico(input);
    const repeated = await repo.emitirAutomatico(input);

    expect(repeated.code).toBe(first.code);
    expect(first).toMatchObject({ institutionId: 'inst-auto-1', studentId: 'student-auto-1', courseId: 'course-auto-1' });
    await expect(repo.listarDoAluno('student-auto-1', 'inst-auto-1')).resolves.toHaveLength(1);
  });

  it('isola a listagem de certificados por aluno e instituição', async () => {
    const repo = new CertificadosRepository();
    await repo.emitirAutomatico({
      institutionId: 'inst-isolada', studentId: 'student-owner', courseId: 'course-owner', studentName: 'Titular',
      courseTitle: 'Curso do titular', durationHours: '1h', issueDate: '14/10/2026', completionDate: '2026-10-14',
    });

    await expect(repo.listarDoAluno('student-other', 'inst-isolada')).resolves.toEqual([]);
    await expect(repo.listarDoAluno('student-owner', 'outra-inst')).resolves.toEqual([]);
  });

  it('preserva no certificado emitido o modelo, a professora e a duração oficial', async () => {
    const repo = new CertificadosRepository();
    const certificate = await repo.emitirAutomatico({
      institutionId: 'inst-history', studentId: 'student-history', courseId: 'course-history',
      studentName: 'Ana', courseTitle: 'Curso especial', durationHours: '1 hora e 30 minutos',
      issueDate: '14/10/2026', completionDate: '2026-10-14',
      certificateTextModel: 'online-course-with-instructor', certificateInstructor: 'Professora Original',
      certificateDurationMinutes: 90,
    });
    const repeated = await repo.emitirAutomatico({
      institutionId: 'inst-history', studentId: 'student-history', courseId: 'course-history',
      studentName: 'Ana', courseTitle: 'Curso especial alterado', durationHours: '3 horas',
      issueDate: '15/10/2026', completionDate: '2026-10-14',
      certificateTextModel: 'online-course-with-instructor', certificateInstructor: 'Professora Nova',
      certificateDurationMinutes: 180,
    });
    expect(repeated).toMatchObject({
      code: certificate.code, courseTitle: 'Curso especial', certificateInstructor: 'Professora Original',
      certificateDurationMinutes: 90, certificateTextModel: 'online-course-with-instructor',
    });
  });

  it('emite curso online com ministrante no layout da marca, sem a arte do template', async () => {
    const repo = new CertificadosRepository();
    await repo.salvarTemplate({
      id: 'course-brand', courseId: 'course-brand', name: 'Arte antiga',
      backgroundUrl: 'data:image/png;base64,AAAA', secondBackgroundUrl: 'data:image/png;base64,BBBB',
      issueDateOverride: '01/01/2020', widthPx: 1123, heightPx: 794, fields: [], updatedAt: '2026-10-14T12:00:00.000Z',
    });
    const online = await repo.emitirAutomatico({
      institutionId: 'inst-brand', studentId: 'student-brand-1', courseId: 'course-brand',
      studentName: 'Ana', courseTitle: 'Curso online', durationHours: '1 hora e 30 minutos',
      issueDate: '14/10/2026', completionDate: '2026-10-14',
      certificateTextModel: 'online-course-with-instructor', certificateInstructor: 'Esp. Professora',
      certificateDurationMinutes: 90,
    });
    expect(online).toMatchObject({ frontImageUrl: undefined, backImageUrl: undefined, issueDate: '14/10/2026' });

    const standard = await repo.emitirAutomatico({
      institutionId: 'inst-brand', studentId: 'student-brand-2', courseId: 'course-brand',
      studentName: 'Bia', courseTitle: 'Curso comum', durationHours: '2h',
      issueDate: '14/10/2026', completionDate: '2026-10-14',
    });
    expect(standard).toMatchObject({ frontImageUrl: 'data:image/png;base64,AAAA', issueDate: '01/01/2020' });
  });
});

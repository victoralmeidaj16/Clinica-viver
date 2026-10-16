import { describe, expect, it } from 'vitest';
import {
  type CertificateRecord,
  DEFAULT_SIGNER_INFO,
  DEFAULT_VALIDATION_URL,
  formatCertificateVersoText,
  formatLongDate,
  generateCertificateCode,
  getMockCertificate,
  renderCertificateText,
  resolveCertificateStampText,
  certificatePublicValidationUrl,
  certificateBodyText,
  certificateBodyParts,
  formatCertificateDuration,
  sanitizeCertificateStamp,
  sanitizeFrontQr,
  DEFAULT_FRONT_QR_X,
  DEFAULT_FRONT_QR_Y,
  DEFAULT_FRONT_QR_SIZE,
  FRONT_QR_SIZE_MAX,
  FRONT_QR_SIZE_MIN,
  STAMP_WIDTH_MAX,
  STAMP_WIDTH_MIN,
} from './certificados';

const certificateFixture: CertificateRecord = {
  id: 'CERT-TESTE',
  code: 'CERT-TESTE',
  studentName: 'Aluno de Teste',
  courseTitle: 'Formação de Teste',
  durationHours: '12h',
  issueDate: '05/03/2026',
  signerInfo: DEFAULT_SIGNER_INFO,
  validationUrl: DEFAULT_VALIDATION_URL,
  status: 'valid',
  createdAt: '2026-03-05T14:30:00.000Z',
};

describe('Módulo de Certificados (Core)', () => {
  it('formata as durações oficiais dos cursos especiais', () => {
    expect(formatCertificateDuration(90)).toBe('1 hora e 30 minutos');
    expect(formatCertificateDuration(180)).toBe('3 horas');
    expect(formatCertificateDuration(210)).toBe('3 horas e 30 minutos');
  });

  it('gera o texto especial somente para o modelo explicitamente configurado', () => {
    const special = {
      ...certificateFixture,
      studentName: 'Ana Beatriz',
      certificateTextModel: 'online-course-with-instructor' as const,
      certificateInstructor: 'Dra. Rafaela Dias Matavelli',
      certificateDurationMinutes: 180,
    };
    expect(certificateBodyText(special)).toBe(
      'Certificamos que Ana Beatriz concluiu o curso Formação de Teste, ministrado pela Dra. Rafaela Dias Matavelli, promovido pela Viver Mais Psicologia, na modalidade online, com duração de 3 horas.',
    );
    expect(certificateBodyText({ ...special, certificateTextModel: 'standard' })).toBeNull();
    expect(certificateBodyText({ ...special, certificateInstructor: '' })).toBeNull();
  });

  it('separa a frase do certificado especial em partes sem alterar o texto', () => {
    const special = {
      ...certificateFixture,
      studentName: 'Ana Beatriz',
      certificateTextModel: 'online-course-with-instructor' as const,
      certificateInstructor: 'Dra. Rafaela Dias Matavelli',
      certificateDurationMinutes: 180,
    };
    const parts = certificateBodyParts(special);
    expect(parts).toMatchObject({ lead: 'Certificamos que', studentName: 'Ana Beatriz', courseTitle: 'Formação de Teste' });
    expect(parts?.after).toBe(', ministrado pela Dra. Rafaela Dias Matavelli, promovido pela Viver Mais Psicologia, na modalidade online, com duração de 3 horas.');
    expect(certificateBodyParts({ ...special, certificateTextModel: 'standard' })).toBeNull();
  });
  it('deve gerar código único de 8 caracteres alfanuméricos', () => {
    const code = generateCertificateCode();
    expect(code).toBeDefined();
    expect(code).toHaveLength(8);
    expect(/^[a-zA-Z0-9]{8}$/.test(code)).toBe(true);
  });

  it('não expõe certificados fictícios como dados semente', () => {
    expect(getMockCertificate('yZV8anjS')).toBeNull();
    expect(getMockCertificate('VVR-DEMO-2026')).toBeNull();
    expect(getMockCertificate('VVR-TEST-3390')).toBeNull();
  });

  it('deve formatar data por extenso corretamente', () => {
    const dataFormatada = formatLongDate('2026-03-05');
    expect(dataFormatada).toContain('2026');
    expect(dataFormatada).toContain('março');
  });

  it('deve substituir variáveis do certificado na renderização', () => {
    const record = certificateFixture;
    const templateText = 'Certificamos que {{nome_do_aluno}} concluiu {{nome_do_curso}} com {{carga_horaria}}h. Código: {{codigo_de_validacao}}';
    const rendered = renderCertificateText(templateText, record);

    expect(rendered).toContain('Aluno de Teste');
    expect(rendered).toContain('Formação de Teste');
    expect(rendered).toContain('12h');
    expect(rendered).toContain('CERT-TESTE');
  });

  it('deve formatar texto de verso sem a linha de assinatura digital', () => {
    const record = certificateFixture;
    const verso = formatCertificateVersoText({
      durationHours: record.durationHours,
      issueDate: record.issueDate,
      code: record.code,
    });

    expect(verso).not.toContain('Assinado de forma digital');
    expect(verso).toContain('CERT-TESTE');
    expect(verso).toContain('vivermaispsicologia.com.br/validarcertificados');
  });

  it('usa o texto editado do carimbo e volta ao gerado quando ele está vazio', () => {
    expect(resolveCertificateStampText({ ...certificateFixture, stampText: 'Texto livre' })).toBe('Texto livre');
    expect(resolveCertificateStampText({ ...certificateFixture, stampText: '   ' })).toContain('CERT-TESTE');
    expect(resolveCertificateStampText(certificateFixture)).toBe(formatCertificateVersoText(certificateFixture));
  });

  it('aponta o QR para a página pública de validação de certificados', () => {
    expect(certificatePublicValidationUrl()).toBe('https://vivermaispsicologia.com.br/validarcertificados');
  });

  it('normaliza largura, texto e QR do carimbo vindos do formulário', () => {
    expect(sanitizeCertificateStamp({ stampWidth: 3, stampText: ' a\r\nb ', stampQr: 'top' })).toEqual({
      stampWidth: STAMP_WIDTH_MIN,
      stampText: 'a\nb',
      stampQr: 'top',
    });
    expect(sanitizeCertificateStamp({ stampWidth: 'x', stampText: '', stampQr: 'meio' })).toEqual({
      stampWidth: undefined,
      stampText: undefined,
      stampQr: undefined,
    });
    expect(sanitizeCertificateStamp({ stampWidth: 200 }).stampWidth).toBe(STAMP_WIDTH_MAX);
  });

  it('normaliza campos do QR da frente vindos do formulário', () => {
    expect(
      sanitizeFrontQr({
        frontQrEnabled: 'true',
        frontQrX: 81.54,
        frontQrY: 68.49,
        frontQrSize: 8.52,
      })
    ).toEqual({
      frontQrEnabled: true,
      frontQrX: 81.5,
      frontQrY: 68.5,
      frontQrSize: 8.5,
    });

    expect(
      sanitizeFrontQr({
        frontQrEnabled: false,
        frontQrX: 'invalid',
        frontQrY: null,
        frontQrSize: 50,
      })
    ).toEqual({
      frontQrEnabled: false,
      frontQrX: undefined,
      frontQrY: undefined,
      frontQrSize: FRONT_QR_SIZE_MAX,
    });

    expect(
      sanitizeFrontQr({
        frontQrSize: 1,
      }).frontQrSize
    ).toBe(FRONT_QR_SIZE_MIN);
  });

  it('exporta coordenadas padrão adequadas para o canto inferior direito da frente', () => {
    expect(DEFAULT_FRONT_QR_X).toBeGreaterThan(70);
    expect(DEFAULT_FRONT_QR_Y).toBeGreaterThan(60);
    expect(DEFAULT_FRONT_QR_SIZE).toBeGreaterThanOrEqual(FRONT_QR_SIZE_MIN);
    expect(DEFAULT_FRONT_QR_SIZE).toBeLessThanOrEqual(FRONT_QR_SIZE_MAX);
  });
});

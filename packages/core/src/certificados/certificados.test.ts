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

  it('deve formatar texto de verso com assinatura digital e carimbo', () => {
    const record = certificateFixture;
    const verso = formatCertificateVersoText({
      durationHours: record.durationHours,
      issueDate: record.issueDate,
      code: record.code,
    });

    expect(verso).toContain('Assinado de forma digital por VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153');
    expect(verso).toContain('CERT-TESTE');
    expect(verso).toContain('www.vivermaispsicologia.com.br');
  });

  it('usa o texto editado do carimbo e volta ao gerado quando ele está vazio', () => {
    expect(resolveCertificateStampText({ ...certificateFixture, stampText: 'Texto livre' })).toBe('Texto livre');
    expect(resolveCertificateStampText({ ...certificateFixture, stampText: '   ' })).toContain('CERT-TESTE');
    expect(resolveCertificateStampText(certificateFixture)).toBe(formatCertificateVersoText(certificateFixture));
  });

  it('aponta o QR para a página pública de conferência do código', () => {
    expect(certificatePublicValidationUrl(' AB c1 ')).toBe(
      'https://www.vivermaispsicologia.com.br/validar-certificado/AB%20c1'
    );
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

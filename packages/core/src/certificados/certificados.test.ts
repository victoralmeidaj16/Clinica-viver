import { describe, expect, it } from 'vitest';
import {
  formatCertificateVersoText,
  formatLongDate,
  generateCertificateCode,
  getMockCertificate,
  renderCertificateText,
  initialCertificates,
} from './certificados';

describe('Módulo de Certificados (Core)', () => {
  it('deve gerar código único de 8 caracteres alfanuméricos', () => {
    const code = generateCertificateCode();
    expect(code).toBeDefined();
    expect(code).toHaveLength(8);
    expect(/^[a-zA-Z0-9]{8}$/.test(code)).toBe(true);
  });

  it('deve localizar certificado nos dados semente por código exato e case-insensitive', () => {
    const cert = getMockCertificate('yZV8anjS');
    expect(cert).not.toBeNull();
    expect(cert?.studentName).toBe('Marina Silva Santos');
    expect(cert?.status).toBe('valid');

    const certLower = getMockCertificate('yzv8anjs');
    expect(certLower).not.toBeNull();
    expect(certLower?.id).toBe('yZV8anjS');
  });

  it('deve formatar data por extenso corretamente', () => {
    const dataFormatada = formatLongDate('2026-03-05');
    expect(dataFormatada).toContain('2026');
    expect(dataFormatada).toContain('março');
  });

  it('deve substituir variáveis do certificado na renderização', () => {
    const record = initialCertificates[0];
    const templateText = 'Certificamos que {{nome_do_aluno}} concluiu {{nome_do_curso}} com {{carga_horaria}}h. Código: {{codigo_de_validacao}}';
    const rendered = renderCertificateText(templateText, record);

    expect(rendered).toContain('Marina Silva Santos');
    expect(rendered).toContain('Pós-Graduação em Psicoterapia Existencial e Fenomenológica');
    expect(rendered).toContain('360h');
    expect(rendered).toContain('yZV8anjS');
  });

  it('deve formatar texto de verso com assinatura digital e carimbo', () => {
    const record = initialCertificates[0];
    const verso = formatCertificateVersoText({
      durationHours: record.durationHours,
      issueDate: record.issueDate,
      code: record.code,
    });

    expect(verso).toContain('Assinado de forma digital por VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153');
    expect(verso).toContain('yZV8anjS');
    expect(verso).toContain('www.vivermaispsicologia.com.br');
  });
});

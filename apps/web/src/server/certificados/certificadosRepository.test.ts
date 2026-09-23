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
});

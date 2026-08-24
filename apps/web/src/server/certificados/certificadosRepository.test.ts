import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { CertificadosRepository } from './certificadosRepository';

describe('CertificadosRepository', () => {
  it('deve consultar certificado por código nos dados semente', async () => {
    const repo = new CertificadosRepository();
    const cert = await repo.porCodigo('yZV8anjS');
    expect(cert).not.toBeNull();
    expect(cert?.studentName).toBe('Marina Silva Santos');
    expect(cert?.durationHours).toBe('360h');
    expect(cert?.status).toBe('valid');
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
});

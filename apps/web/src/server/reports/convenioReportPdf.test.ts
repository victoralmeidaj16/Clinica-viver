import { mkdir, writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { gerarRelatorioConvenioPdf } from './convenioReportPdf';

describe('gerarRelatorioConvenioPdf', () => {
  it('gera um PDF paginado e válido para o relatório empresarial', async () => {
    const pdf = await gerarRelatorioConvenioPdf({
      id: 'convenio-teste', nome: 'Empresa Conveniada Exemplo', razaoSocial: 'Empresa Conveniada Exemplo Ltda.',
      cnpj: '19440737000153', emailFaturamento: 'financeiro@empresa.example',
      empresaPagaSessoes: true, ativo: true, pacientes: 2, pacientesCusteados: 2,
      sessoesProvisionadas: 2, valorProvisionadoCents: 20_500,
    }, [
      { chargeId: 'charge-1', sessionId: 'session-1', patientId: 'patient-1', pacienteNome: 'Paciente Um', professionalId: 'professional-1', psicologoNome: 'Dra. Helena', realizadaEm: '2026-08-05T17:00:00.000Z', valorCents: 7_500, status: 'pending' },
      { chargeId: 'charge-2', sessionId: 'session-2', patientId: 'patient-2', pacienteNome: 'Paciente Dois', professionalId: 'professional-2', psicologoNome: 'Dr. Augusto', realizadaEm: '2026-08-12T20:00:00.000Z', valorCents: 13_000, status: 'paid', faturaId: 'invoice-1' },
    ], { inicio: '2026-08-01', fim: '2026-08-31' });

    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(2_000);
    if (process.env.WRITE_CONVENIO_PDF_SAMPLE === '1') {
      await mkdir('../../tmp/pdfs', { recursive: true });
      await writeFile('../../tmp/pdfs/relatorio-convenio-amostra.pdf', pdf);
    }
  });
});

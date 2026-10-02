import { writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { buildPsychologicalDocument, type IssuedPsychologicalDocument } from '@thats-life/core';
vi.mock('server-only', () => ({}));
import { psychologicalDocumentPdf } from './documentPdf';

const context = { patientName: 'Paciente Exemplo', professionalName: 'Profissional Exemplo', organizationName: 'Clínica Viver Mais', crp: '08/12345', location: 'Curitiba/PR', date: '2026-10-02' };
describe('PDF dos documentos', () => {
  it.each(['attendance', 'referral'] as const)('gera %s com paginação e assinatura', async (kind) => {
    const content = buildPsychologicalDocument({ kind, location: context.location, purpose: 'Comprovação de comparecimento', recipient: 'Serviço de referência', demand: 'Solicitação de avaliação complementar.', procedures: 'Entrevistas e acompanhamento clínico.', analysis: 'Texto de teste para verificar a paginação do relatório e a preservação das informações. '.repeat(45), conclusion: 'Encaminho para avaliação e continuidade do cuidado.' }, context, [{ id: 'appointment', startsAt: '2026-10-01T15:00:00Z', endsAt: '2026-10-01T15:50:00Z' }]);
    const document: IssuedPsychologicalDocument = { id: 'abc123'.repeat(10), patientId: 'patient', organizationId: 'org', professionalId: 'psi', issuedBy: 'user', issuedAt: '2026-10-02T15:00:00Z', requestHash: 'test', content };
    const pdf = await psychologicalDocumentPdf(document);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pages).toBe(kind === 'attendance' ? 1 : 2);
    if (process.env.DOCUMENT_PDF_TEST_OUTPUT) await writeFile(`${process.env.DOCUMENT_PDF_TEST_OUTPUT}-${kind}.pdf`, pdf);
  });
});

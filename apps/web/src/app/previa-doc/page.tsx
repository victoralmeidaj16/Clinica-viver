'use client';

// TEMPORÁRIO — conferência visual do layout da declaração. Apagar.
import { DocumentoDeclaracao } from '@/components/declaracao/DocumentoDeclaracao';
import '../relatorios/declaracao/declaracao.css';

export default function Preview() {
  return (
    <div className="bg-slate-100 p-8 print:p-0 print:bg-white">
      <DocumentoDeclaracao
        declaracao={{
          psicologoNome: '[NOME DO ALUNO]',
          psicologoCrp: '[xx/xxxxx]',
          tratamento: 'Pós-Graduanda',
          curso: '[CURSO — Turma XX]',
          periodoInicio: '2025-03-10',
          periodoFim: '2026-08-14',
          totalHoras: 180,
          coordenadora: 'GIULIANA ALANO DE OLIVEIRA',
          supervisora: 'ALINE ALVES DE ANDRADE FURLAN DE SÁ',
          emitidoEm: '2026-08-06T12:00:00.000Z',
        }}
      />
    </div>
  );
}

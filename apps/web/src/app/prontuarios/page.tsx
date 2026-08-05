'use client';

import React, { useState } from 'react';
import {
  FileText,
  Lock,
  ShieldCheck,
  Download,
  Search,
  Calendar,
  Plus,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import NewSoapRecordModal, { SoapRecordItem } from '@/components/prontuarios/NewSoapRecordModal';
import ViewSoapRecordModal from '@/components/prontuarios/ViewSoapRecordModal';

const INITIAL_SOAP_RECORDS: SoapRecordItem[] = [
  {
    id: 'SOAP-2026-001',
    paciente: 'Mariana Silva de Oliveira',
    patientId: 'pac_01',
    data: '29/07/2026 às 14:30',
    tipo: 'Consulta Individual (TCC)',
    status: 'Aprovado & Criptografado',
    hash: 'e2b6fbef007f46c29340193a1250c0e18c71a48e7b554de0f00b0a6a22d7d37e',
    subjective:
      'Paciente relata semana intensa de trabalho com reestruturação de metas e reuniões de alinhamento com a nova diretoria. Menciona oscilações de humor (registro 2/5 em 27/07) acompanhadas de insônia inicial e pensamentos automáticos de autocobrança ("tenho que entregar tudo com perfeição").',
    objective:
      'Apresenta-se orientada no tempo e espaço, afeto congruente com o relato, comunicação fluida. Aplicado rastreio GAD-7 pré-sessão com escore total 12 (Ansiedade Moderada). Sem sinais de ideação de risco.',
    assessment:
      'Evolução dentro da hipótese de Ansiedade Ocupacional / Transtorno de Ansiedade Generalizada em grau moderado. Boa capacidade de reflexão e adesão às técnicas de reestruturação cognitiva. Mantida a meta de construção de limites interpessoais sustentáveis.',
    plan:
      '1. Manter diário RPD focando em episódios de cobrança no trabalho.\n2. Praticar 10 min de respiração diafragmática ao acordar (hábito ativo).\n3. Rascunhar tópicos de alinhamento assertivo com a gerência antes do próximo atendimento.',
  },
  {
    id: 'SOAP-2026-002',
    paciente: 'Lucas Ramos Oliveira',
    patientId: 'pac_02',
    data: '28/07/2026 às 16:30',
    tipo: 'Existencialismo Clínico',
    status: 'Aprovado & Criptografado',
    hash: 'a571f900192848c29340193a1250c0f94e57862d886557d1d3ccf9ec142234f5',
    subjective:
      'Paciente trouxe reflexões sobre a proposta de transição de carreira recebida durante a semana. Relata alívio ao perceber que seus valores pessoais estão desalinhados da cultura atual da empresa.',
    objective:
      'Postura relaxada, tom de voz sereno e engajado. Demonstra maior clareza de propósito em relação aos atendimentos anteriores.',
    assessment:
      'Avanço significativo na tomada de decisão consciente. Redução de ruminação relacionada ao medo de frustrar expectativas de terceiros.',
    plan:
      '1. Mapear prós e contras financeiros da transição para a próxima sessão.\n2. Manter diário de valores e projeto de vida.',
  },
  {
    id: 'SOAP-2026-003',
    paciente: 'Beatriz Santos Guimarães',
    patientId: 'pac_03',
    data: '27/07/2026 às 10:00',
    tipo: 'Terapia de Aceitação (ACT)',
    status: 'Aprovado & Criptografado',
    hash: 'c881fa22001948c29340193a1250c0aa9f8e7d6c5b4a0123456789abcdef0123',
    subjective:
      'Relata início da nova rotina de estudos para concurso. Menciona momentos de desatenção e frustração com o ritmo de leitura.',
    objective:
      'Aplicada escala de rastreio de TDAH. Escore ASRS-18 com indicativo moderado para desatenção sem hiperatividade motora expressiva.',
    assessment:
      'Trabalhada a desfusão cognitiva em relação a pensamentos de "não vou conseguir manter a constância".',
    plan:
      '1. Aplicar técnica Pomodoro de 25 minutos com blocos de descanso ativo.\n2. Prática diária de mindfulness focada na ancoragem respiratória.',
  },
];

export default function ProntuariosPage() {
  const [records, setRecords] = useState<SoapRecordItem[]>(INITIAL_SOAP_RECORDS);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<SoapRecordItem | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const filteredRecords = records.filter(
    (r) =>
      r.paciente.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.tipo.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveNewRecord = (newRecord: SoapRecordItem) => {
    setRecords([newRecord, ...records]);
    setToastMessage(`Prontuário ${newRecord.id} assinado e encriptado com sucesso!`);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleExportSinglePdf = (record: SoapRecordItem) => {
    const textContent = `
================================================================================
THAT'S LIFE PSI - PRONTUÁRIO CLÍNICO DE EVOLUÇÃO (SOAP)
================================================================================
Paciente: ${record.paciente}
Código do Prontuário: ${record.id}
Data do Atendimento: ${record.data}
Tipo: ${record.tipo}
Status: ${record.status}
Integridade SHA-256: ${record.hash}
Guarda Regulatória: 5 anos (Resolução CFP N.º 01/2009)

--------------------------------------------------------------------------------
1. SUBJETIVO (S)
--------------------------------------------------------------------------------
${record.subjective}

--------------------------------------------------------------------------------
2. OBJETIVO (O)
--------------------------------------------------------------------------------
${record.objective}

--------------------------------------------------------------------------------
3. AVALIAÇÃO (A)
--------------------------------------------------------------------------------
${record.assessment}

--------------------------------------------------------------------------------
4. PLANO (P)
--------------------------------------------------------------------------------
${record.plan}

--------------------------------------------------------------------------------
Assinado Digitalmente por: Dra. Camila Vasconcelos — CRP 06/148293
Documento com validade clínica e jurídica em conformidade com CFP & LGPD.
================================================================================
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prontuario-${record.id}-${record.paciente.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    setToastMessage(`Prontuário ${record.id} exportado com sucesso.`);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Toast message */}
      {toastMessage && (
        <div className="bg-emerald-600 text-white p-4 rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <p className="text-xs font-bold">{toastMessage}</p>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="chip-capri text-[11px] mb-1">Guarda Regulatória de 5 Anos (CFP N.º 01/2009)</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Prontuários Clínicos SOAP Armazenados
          </h1>
          <p className="text-xs text-muted">
            Histórico completo de evoluções encriptadas em repouso com hash SHA-256 e auditoria legal.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 bg-surface px-3 py-2 rounded-xl border border-line text-xs font-bold text-ink">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>AES-256 Compliant</span>
          </div>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="btn-accent py-2.5 px-4 text-xs shadow-md flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Elaborar Prontuário SOAP</span>
          </button>
        </div>
      </div>

      {/* Main Card List */}
      <div className="card space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-line pb-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por paciente, tipo ou código SOAP..."
              className="input text-xs pl-9 py-2"
            />
          </div>
          <span className="text-xs text-muted font-semibold">
            {filteredRecords.length} prontuários encontrados
          </span>
        </div>

        <div className="space-y-3">
          {filteredRecords.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-2xl border border-line bg-canvas/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white hover:shadow-card transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-psi-darkest text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm">
                  <Lock className="w-5 h-5 text-psi-vibrant" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-ink">{item.paciente}</span>
                    <span className="text-[10px] font-mono bg-psi-soft text-psi-darkest px-2 py-0.5 rounded-md font-bold">
                      {item.id}
                    </span>
                    <span className="text-[10px] bg-white border border-line text-muted px-2 py-0.5 rounded-md font-semibold">
                      {item.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-muted flex items-center gap-2 mt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-primary" />
                      {item.data}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[10px] text-slate-400">
                      SHA-256: {item.hash.substring(0, 16)}...
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => setSelectedRecord(item)}
                  className="btn-outline text-xs py-2 px-3 flex items-center gap-1.5"
                  title="Visualizar SOAP Completo"
                >
                  <Eye className="w-3.5 h-3.5 text-psi-vibrant" />
                  <span>Ver Detalhes</span>
                </button>
                <button
                  onClick={() => handleExportSinglePdf(item)}
                  className="btn-ghost text-xs p-2 text-muted hover:text-ink"
                  title="Exportar Prontuário"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {filteredRecords.length === 0 && (
            <p className="p-8 text-center text-xs text-muted">
              Nenhum prontuário encontrado com o termo informado.
            </p>
          )}
        </div>
      </div>

      {/* Modais */}
      <NewSoapRecordModal
        isOpen={isNewModalOpen}
        onClose={() => setIsNewModalOpen(false)}
        onSave={handleSaveNewRecord}
      />

      <ViewSoapRecordModal
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onExportPdf={handleExportSinglePdf}
      />
    </div>
  );
}

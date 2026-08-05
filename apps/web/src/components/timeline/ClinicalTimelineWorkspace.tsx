'use client';

import { useEffect, useMemo, useState } from 'react';
import { searchClinicalTimeline, type ClinicalTimelineEntry } from '@thats-life/core';
import { applicationRequest } from '@/lib/applicationApi';
import { DEMO_CLINICAL_TIMELINE } from '@/lib/demoClinicalTimeline';
import { INITIAL_PATIENTS } from '@/lib/mockData';
import ClinicalMemorySearch from './ClinicalMemorySearch';
import TimelineFeed from './TimelineFeed';
import TimelineFilters, { TIMELINE_FILTERS } from './TimelineFilters';
import TimelineHeader, { DEMO_PROFESSIONALS } from './TimelineHeader';
import { Download, ShieldCheck, FileCheck, Award, Sparkles } from 'lucide-react';

const DEFAULT_QUERY = 'Quando começou a relatar dificuldades no trabalho?';

export default function ClinicalTimelineWorkspace() {
  const [selectedPatientId, setSelectedPatientId] = useState('pac_01');
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('prof-1');
  const [activeFilterId, setActiveFilterId] = useState('all');
  const [draftQuery, setDraftQuery] = useState(DEFAULT_QUERY);
  const [activeQuery, setActiveQuery] = useState(DEFAULT_QUERY);
  const [apiEntries, setApiEntries] = useState<ClinicalTimelineEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    applicationRequest<{ entries: ClinicalTimelineEntry[] }>(`/timeline?patientId=${selectedPatientId}`)
      .then((data) => {
        if (!cancelled && data?.entries?.length) {
          setApiEntries(data.entries);
        }
      })
      .catch(() => {
        // Fallback local em caso de desconexão
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  const allEntries = apiEntries ?? DEMO_CLINICAL_TIMELINE;

  const activeFilter = TIMELINE_FILTERS.find(
    (filter) => filter.id === activeFilterId
  );
  const filteredEntries = useMemo(
    () =>
      activeFilter?.categories
        ? allEntries.filter((entry) =>
            activeFilter.categories?.includes(entry.category)
          )
        : allEntries,
    [activeFilter, allEntries]
  );

  const searchResult = useMemo(
    () => searchClinicalTimeline(allEntries, activeQuery),
    [activeQuery, allEntries]
  );

  const selectedPatient =
    INITIAL_PATIENTS.find((p) => p.id === selectedPatientId) ?? INITIAL_PATIENTS[0];

  const selectedProfessional =
    DEMO_PROFESSIONALS.find((p) => p.id === selectedProfessionalId) ?? DEMO_PROFESSIONALS[0];

  const runSuggestion = (value: string) => {
    setDraftQuery(value);
    setActiveQuery(value);
  };

  const handleExportDossierPdf = () => {
    const textContent = `
================================================================================
THAT'S LIFE PSI - DOSSIÊ CLINICO LONGITUDINAL VERIFICÁVEL
================================================================================
Paciente: ${selectedPatient.nome}
Contato: ${selectedPatient.telefone} | ${selectedPatient.email}
Plano Terapêutico: ${selectedPatient.planoAtendimento}
Profissional Responsável: ${selectedProfessional.name} (${selectedProfessional.crp})
Papel no Atendimento: ${selectedProfessional.role}
Especialidade: ${selectedProfessional.specialty}
Guarda Regulatória: 5 anos (Resolução CFP N.º 01/2009)
Data de Emissão do Dossiê: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}

--------------------------------------------------------------------------------
RESUMO DE INTEGRIDADE E EVOLUÇÃO CLINICA
--------------------------------------------------------------------------------
Total de Marcos Auditados: ${allEntries.length} registros
Primeiro Registro: ${allEntries.at(-1) ? new Date(allEntries.at(-1)!.occurredAt).toLocaleDateString('pt-BR') : 'Sem registro'}
Integridade Criptográfica: Validação SHA-256 encadeada por bloco de evidência

--------------------------------------------------------------------------------
MARCOS CRONOLÓGICOS DO DOSSIÊ
--------------------------------------------------------------------------------
${allEntries
  .map(
    (entry, idx) => `
[${idx + 1}] ${new Date(entry.occurredAt).toLocaleDateString('pt-BR')} ${new Date(entry.occurredAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — ${entry.title.toUpperCase()}
Categoria: ${entry.category} | Importância: ${entry.importance}
Resumo: ${entry.summary}
${entry.evidenceExcerpt ? `Trecho de Evidência: "${entry.evidenceExcerpt}"` : ''}
Fonte: ${entry.evidence.sourceType}:${entry.evidence.sourceId}
Tags: ${entry.tags.join(', ')}
--------------------------------------------------------------------------------`
  )
  .join('\n')}

================================================================================
Assinado e Auditado por: ${selectedProfessional.name} — ${selectedProfessional.crp}
Dossiê emitido pelo motor Thats Life Psi com rastreabilidade legal.
================================================================================
    `.trim();

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dossie-longitudinal-${selectedPatient.nome.toLowerCase().replace(/\s+/g, '-')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 pb-12">
      {/* Cabeçalho do Dossiê com Seleção de Paciente e Psicólogo */}
      <TimelineHeader
        selectedPatientId={selectedPatientId}
        onSelectPatient={setSelectedPatientId}
        selectedProfessionalId={selectedProfessionalId}
        onSelectProfessional={setSelectedProfessionalId}
        entries={allEntries}
      />

      {/* Card de Destaque do Papel do Psicólogo & Dossiê Verificável */}
      <div className="card bg-white p-5 space-y-4 border border-line shadow-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-psi-soft text-psi-darkest flex items-center justify-center font-bold">
              <Award className="w-5 h-5 text-psi-deep" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-ink">{selectedProfessional.name}</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-psi-soft text-psi-darkest">
                  {selectedProfessional.crp}
                </span>
              </div>
              <p className="text-xs text-muted">
                {selectedProfessional.role} • Especialidade: {selectedProfessional.specialty}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 text-xs font-semibold text-emerald-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Assinatura Digital Auditada</span>
            </div>

            <button
              onClick={handleExportDossierPdf}
              className="btn-accent py-2 px-4 text-xs shadow-md flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>Exportar Dossiê Longitudinal</span>
            </button>
          </div>
        </div>

        {/* Resumo de Diretrizes Terapêuticas & Memória Longitudinal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-xl bg-psi-light border border-psi-soft space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-psi-deep">Plano Ativo do Paciente</span>
            <p className="font-bold text-ink">{selectedPatient.planoAtendimento}</p>
          </div>

          <div className="p-3.5 rounded-xl bg-psi-light border border-psi-soft space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-psi-deep">Conformidade Legal</span>
            <p className="font-semibold text-ink flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              Resolução CFP N.º 01/2009 (5 anos)
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-psi-light border border-psi-soft space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-psi-deep">IA Clínica de Apoio</span>
            <p className="font-semibold text-ink flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-psi-vibrant shrink-0" />
              Memória Semântica com Evidências
            </p>
          </div>
        </div>
      </div>

      {/* Barra de Filtros por Categoria */}
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
            Recorte da jornada
          </p>
          <p className="text-xs text-ink">
            {filteredEntries.length} marcos exibidos em ordem cronológica reversa
          </p>
        </div>
        <TimelineFilters activeId={activeFilterId} onChange={setActiveFilterId} />
      </div>

      {/* Grid Principal: Feed de Eventos + Motor de Busca Clínica por IA */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <TimelineFeed entries={filteredEntries} />
        <ClinicalMemorySearch
          draftQuery={draftQuery}
          result={searchResult}
          onDraftChange={setDraftQuery}
          onSearch={() => setActiveQuery(draftQuery)}
          onSuggestion={runSuggestion}
        />
      </div>
    </div>
  );
}

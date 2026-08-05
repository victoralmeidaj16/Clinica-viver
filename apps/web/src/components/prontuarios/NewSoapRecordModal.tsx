'use client';

import React, { useState } from 'react';
import { X, Save, Sparkles, FileText, ShieldCheck } from 'lucide-react';
import { INITIAL_PATIENTS } from '@/lib/mockData';

export interface SoapRecordItem {
  id: string;
  paciente: string;
  patientId: string;
  data: string;
  tipo: string;
  status: string;
  hash: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

interface NewSoapRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (record: SoapRecordItem) => void;
}

export default function NewSoapRecordModal({ isOpen, onClose, onSave }: NewSoapRecordModalProps) {
  const [patientId, setPatientId] = useState(INITIAL_PATIENTS[0].id);
  const [tipo, setTipo] = useState('Consulta Individual (TCC)');
  const [subjective, setSubjective] = useState('');
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState('');
  const [plan, setPlan] = useState('');

  if (!isOpen) return null;

  const selectedPatient = INITIAL_PATIENTS.find((p) => p.id === patientId) ?? INITIAL_PATIENTS[0];

  const handleFillDemo = () => {
    setSubjective(
      'Paciente relata semana com episódios de ansiedade antecipatória associada a apresentações no trabalho. Notou aumento de frequência cardíaca e pensamento automático "vou me enrolar nas respostas".'
    );
    setObjective(
      'Apresenta-se orientada, afeto congruente, postura receptiva. Aplicado RPD em sessão e treino de respiração diafragmática. Escore GAD-7 pré-sessão: 10 (Ansiedade Moderada).'
    );
    setAssessment(
      'Evolução satisfatória quanto ao reconhecimento de gatilhos corporais. Reestruturação cognitiva iniciada com questionamento socrático sobre catastrofização.'
    );
    setPlan(
      '1. Manter diário de RPD para episódios no ambiente de trabalho.\n2. Praticar 10 minutos de respiração diafragmática ao acordar.\n3. Enviar check-in pré-sessão antes do próximo atendimento.'
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjective || !assessment) return;

    const randomHash = Array.from({ length: 32 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join('');

    const now = new Date();
    const formattedDate = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

    const newRecord: SoapRecordItem = {
      id: `SOAP-2026-${Math.floor(100 + Math.random() * 900)}`,
      paciente: selectedPatient.nome,
      patientId: selectedPatient.id,
      data: formattedDate,
      tipo,
      status: 'Aprovado & Criptografado',
      hash: randomHash,
      subjective,
      objective: objective || 'Paciente em acompanhamento psicoterapêutico regular.',
      assessment,
      plan: plan || 'Manter rotina terapêutica combinada.',
    };

    onSave(newRecord);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div className="bg-surface border border-line rounded-2xl w-full max-w-2xl shadow-2xl p-6 space-y-5 relative my-8">
        <button onClick={onClose} className="absolute top-4 right-4 text-muted hover:text-ink p-1">
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-ink">Elaborar Novo Prontuário SOAP</h3>
              <p className="text-xs text-muted">Estruturação clínica em conformidade com o CFP</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleFillDemo}
            className="btn-outline text-xs py-1.5 px-3 flex items-center gap-1.5 text-psi-deep border-psi-vibrant/30 bg-psi-soft/40"
          >
            <Sparkles className="w-3.5 h-3.5 text-psi-vibrant" />
            <span>Preencher Rascunho IA</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-ink mb-1 block">Paciente *</label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="input cursor-pointer"
              >
                {INITIAL_PATIENTS.map((patient) => (
                  <option key={patient.id} value={patient.id}>
                    {patient.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-ink mb-1 block">Tipo de Atendimento</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="input cursor-pointer"
              >
                <option value="Consulta Individual (TCC)">Consulta Individual (TCC)</option>
                <option value="Sessão de Anamnese">Sessão de Anamnese</option>
                <option value="Sessão de Regulação Emocional">Sessão de Regulação Emocional</option>
                <option value="Atendimento de Casal">Atendimento de Casal</option>
                <option value="Devolutiva de Avaliação">Devolutiva de Avaliação</option>
              </select>
            </div>
          </div>

          {/* S - Subjetivo */}
          <div>
            <label className="font-bold text-ink mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-psi-vibrant text-white font-mono text-[11px] flex items-center justify-center">S</span>
              Subjetivo (Relato e demandas do paciente) *
            </label>
            <textarea
              required
              rows={3}
              value={subjective}
              onChange={(e) => setSubjective(e.target.value)}
              placeholder="Descreva a queixa principal, sentimentos relatados e percepções do paciente durante a semana..."
              className="input leading-relaxed"
            />
          </div>

          {/* O - Objetivo */}
          <div>
            <label className="font-bold text-ink mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-psi-deep text-white font-mono text-[11px] flex items-center justify-center">O</span>
              Objetivo (Observações clínicas e pontuações de escalas)
            </label>
            <textarea
              rows={2}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Postura corporal, afeto, resultados de testes psicométricos aplicados, afeto..."
              className="input leading-relaxed"
            />
          </div>

          {/* A - Avaliação */}
          <div>
            <label className="font-bold text-ink mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-psi-darkest text-white font-mono text-[11px] flex items-center justify-center">A</span>
              Avaliação (Formulação e progresso terapêutico) *
            </label>
            <textarea
              required
              rows={2}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              placeholder="Análise do progresso, hipóteses diagnósticas e conexões conceituais TCC..."
              className="input leading-relaxed"
            />
          </div>

          {/* P - Plano */}
          <div>
            <label className="font-bold text-ink mb-1 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-mono text-[11px] flex items-center justify-center">P</span>
              Plano (Tarefas de casa, próximas estratégias e encaminhamentos)
            </label>
            <textarea
              rows={2}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Estratégias para a próxima sessão, tarefas psicoeducativas..."
              className="input leading-relaxed"
            />
          </div>

          <div className="pt-3 border-t border-line flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-semibold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Assinatura digital e encriptação AES-256 serão geradas ao salvar.</span>
            </div>

            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className="btn-ghost text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary text-xs py-2.5 px-5">
                <Save className="w-4 h-4" />
                <span>Aprovar & Assinar Prontuário</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

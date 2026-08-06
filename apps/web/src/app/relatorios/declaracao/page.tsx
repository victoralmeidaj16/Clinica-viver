'use client';

import React, { useState } from 'react';
import { FileText, Printer, ShieldCheck, Download, UserCheck, Calendar, Award } from 'lucide-react';

interface DeclaracaoData {
  nomePsicologo: string;
  crp: string;
  cursoTurma: string;
  mesAnoInicio: string;
  mesAnoFim: string;
  totalHoras: number;
  dataEmissao: string;
  nomeCoordenadora: string;
  nomeSupervisora: string;
}

export default function DeclaracaoHorasPage() {
  const [formData, setFormData] = useState<DeclaracaoData>({
    nomePsicologo: 'Dra. Mariana Souza',
    crp: '12/34567',
    cursoTurma: 'Psicologia Clínica Integrativa – Turma 04',
    mesAnoInicio: 'Março de 2025',
    mesAnoFim: 'Agosto de 2026',
    totalHoras: 180,
    dataEmissao: '06 de Agosto de 2026',
    nomeCoordenadora: 'GIULIANA ALANO DE OLIVEIRA',
    nomeSupervisora: 'ALINE ALVES DE ANDRADE FURLAN DE SÁ',
  });
  // Começa carregando: o efeito abaixo dispara a busca no primeiro render, e
  // marcar o estado dentro dele apenas encadearia um render a mais.
  const [isLoading, setIsLoading] = useState(true);

  React.useEffect(() => {
    fetch('/api/application/declaracao-horas')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data) {
          setFormData((prev) => ({
            ...prev,
            ...data.data,
          }));
        }
      })
      .catch((err) => console.warn('Usando valores de baseline para declaração:', err))
      .finally(() => setIsLoading(false));
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-800 font-sans print:p-0 print:bg-white">
      {/* Painel de Controle (Oculto na Impressão) */}
      <div className="max-w-4xl mx-auto mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-xl text-purple-800">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Emissor de Declaração de Horas de Atendimento</h1>
              <p className="text-xs text-slate-500">
                Gere a declaração oficial da Viver Mais Psicologia para comprovação de estágio/carga horária na coordenação.
              </p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 px-5 py-2.5 bg-purple-800 hover:bg-purple-900 text-white font-semibold rounded-xl transition-all shadow-md shadow-purple-900/10"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir / Salvar PDF</span>
          </button>
        </div>

        {/* Formulário de Configuração */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Nome do Psicólogo(a)</label>
            <input
              type="text"
              value={formData.nomePsicologo}
              onChange={(e) => setFormData({ ...formData, nomePsicologo: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">CRP</label>
            <input
              type="text"
              value={formData.crp}
              onChange={(e) => setFormData({ ...formData, crp: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Curso / Turma</label>
            <input
              type="text"
              value={formData.cursoTurma}
              onChange={(e) => setFormData({ ...formData, cursoTurma: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Mês/Ano Início</label>
            <input
              type="text"
              value={formData.mesAnoInicio}
              onChange={(e) => setFormData({ ...formData, mesAnoInicio: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Mês/Ano Fim</label>
            <input
              type="text"
              value={formData.mesAnoFim}
              onChange={(e) => setFormData({ ...formData, mesAnoFim: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Total de Horas Realizadas</label>
            <input
              type="number"
              value={formData.totalHoras}
              onChange={(e) => setFormData({ ...formData, totalHoras: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
            />
          </div>
        </div>
      </div>

      {/* DOCUMENTO OFICIAL A4 PARA IMPRESSÃO */}
      <div className="max-w-[794px] mx-auto bg-white min-h-[1123px] relative flex flex-col justify-between p-12 shadow-2xl rounded-sm print:shadow-none print:m-0 print:w-full print:max-w-none print:min-h-screen">
        
        {/* Top Header Design Visual Viver Mais */}
        <div>
          {/* Listras coloridas do topo */}
          <div className="flex space-x-1.5 h-16 mb-8">
            <div className="w-2.5 h-full bg-cyan-400 rounded-full" />
            <div className="w-2.5 h-4/5 bg-amber-400 rounded-full" />
            <div className="w-2.5 h-full bg-red-400 rounded-full" />
            <div className="w-2.5 h-3/4 bg-blue-500 rounded-full" />
            <div className="w-2.5 h-full bg-cyan-500 rounded-full" />
            <div className="w-2.5 h-4/5 bg-red-500 rounded-full" />
            <div className="w-2.5 h-full bg-amber-500 rounded-full" />
            
            {/* Logo Viver Mais no lado direito */}
            <div className="ml-auto flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-800 to-indigo-900 rounded-xl flex items-center justify-center transform rotate-12 shadow-md">
                <span className="text-amber-400 font-extrabold text-xl -rotate-12">V</span>
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-slate-800 leading-none">VIVER <span className="text-xs font-semibold text-purple-900 block tracking-widest">MAIS</span></span>
                <span className="text-[10px] font-bold text-purple-800 tracking-wider">PSICOLOGIA</span>
              </div>
            </div>
          </div>

          {/* Título Principal Centrado */}
          <div className="text-center my-12">
            <h2 className="text-xl font-bold tracking-widest text-slate-900 uppercase">VIVER MAIS PSICOLOGIA</h2>
            <h3 className="text-lg font-extrabold tracking-widest text-slate-900 mt-8">DECLARAÇÃO</h3>
          </div>

          {/* Corpo do Texto Principal da Declaração */}
          <div className="text-slate-800 text-base leading-relaxed text-justify my-12 px-4 space-y-6">
            <p>
              Eu, <strong>{formData.nomeCoordenadora}</strong>, coordenadora da Clínica de Atendimento Psicológico Viver Mais,
              inscrita no CNPJ 19.440.737/0001-53, declaro, para fins de comprovação de cumprimento da
              carga horária de estágio em atendimento psicológico, que <strong>{formData.nomePsicologo}</strong>, CRP{' '}
              <strong>[{formData.crp}]</strong>, Pós-Graduanda em <strong>[{formData.cursoTurma}]</strong>, realizou atendimentos psicológicos no
              período de <strong>[{formData.mesAnoInicio}]</strong> a <strong>[{formData.mesAnoFim}]</strong>, totalizando <strong>{formData.totalHoras} horas</strong> de atendimento clínico nesta
              instituição.
            </p>
          </div>
        </div>

        {/* Rodapé e Assinaturas */}
        <div className="mt-auto">
          {/* Data e Local */}
          <div className="text-right text-sm font-medium text-slate-800 mb-20 pr-4">
            Tubarão, {formData.dataEmissao}.
          </div>

          {/* Linhas de Assinatura */}
          <div className="grid grid-cols-2 gap-8 px-4 text-center mb-16">
            <div className="flex flex-col items-center">
              <div className="w-full border-b-2 border-purple-900 mb-3" />
              <span className="font-extrabold text-sm uppercase text-purple-900 tracking-wide">
                {formData.nomeCoordenadora}
              </span>
              <span className="text-xs font-semibold text-slate-700 mt-1">Coordenadora</span>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-full border-b-2 border-purple-900 mb-3" />
              <span className="font-extrabold text-sm uppercase text-purple-900 tracking-wide">
                {formData.nomeSupervisora}
              </span>
              <span className="text-xs font-semibold text-slate-700 mt-1">Psicóloga</span>
            </div>
          </div>

          {/* Rodapé Colorido Inferior */}
          <div className="pt-4 border-t border-purple-100 flex items-center justify-between text-[11px] text-purple-950 font-medium">
            <div className="flex items-center space-x-4">
              <span>📞 (48) 99904-8086</span>
              <span>🌐 vivermaispsicologia.com.br</span>
            </div>
            <div className="flex items-center space-x-4">
              <span>📷 @vivermaispsicologia</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

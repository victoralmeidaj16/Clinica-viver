'use client';

import React from 'react';
import { anonymizeClinicalNote } from '@thats-life/core';
import { ShieldCheck, Eye, CheckCircle2, MessageSquare } from 'lucide-react';

export default function SupervisaoPage() {
  const rawCaseText = `Paciente Mariana Silva de Oliveira, 30 anos, moradora do bairro Pinheiros em São Paulo (CPF 342.190.878-10). Atendida na clínica da Av. Paulista em 29/07/2026. Relata que trabalha no banco Itaú sob supervisão do gerente Roberto. Apresentou crise de pânico durante reunião de metas na terça-feira passada.`;

  const anonymization = anonymizeClinicalNote(rawCaseText, {
    knownIdentifiers: [
      'Mariana Silva de Oliveira',
      'Pinheiros',
      'São Paulo',
      'Av. Paulista',
      '29/07/2026',
      'Itaú',
      'Roberto',
    ],
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="card bg-gradient-to-r from-purple-950 via-primary to-indigo-950 text-white p-6 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-capri" />
          <span className="text-xs font-bold uppercase tracking-wider text-capri">Módulo de Supervisão Clínica & Clínicas-Escola</span>
        </div>
        <h1 className="text-2xl font-black">Demonstração de Remoção Heurística de PII</h1>
        <p className="text-xs text-white/80 max-w-2xl">
          Pré-processamento de identificadores para revisão humana antes de qualquer compartilhamento com supervisores.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lado Esquerdo: Relato Original */}
        <div className="card space-y-3 bg-white">
          <div className="flex items-center justify-between border-b border-line pb-2">
            <h3 className="text-xs font-bold text-ink flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-coral" />
              Relato Original do Prontuário (Com PII)
            </h3>
            <span className="chip-accent text-[10px]">Acesso Restrito ao Terapeuta</span>
          </div>
          <p className="text-xs text-muted leading-relaxed font-mono bg-canvas p-3 rounded-xl border border-line">
            {rawCaseText}
          </p>
          <div className="text-[11px] text-coral font-medium flex items-center gap-1">
            ⚠️ Contém dados sensíveis (Nome, CPF, Bairro e Empresa).
          </div>
        </div>

        {/* Lado Direito: Relato Anonimizado por IA */}
        <div className="card space-y-3 bg-emerald-50/40 border-emerald-200">
          <div className="flex items-center justify-between border-b border-emerald-200 pb-2">
            <h3 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Relato Pré-processado
            </h3>
            <span className="chip text-[10px] bg-emerald-100 text-emerald-800 border-emerald-300">
              Revisão humana obrigatória
            </span>
          </div>

          <p className="text-xs text-emerald-950 leading-relaxed font-mono bg-white p-3 rounded-xl border border-emerald-200">
            {anonymization.textAnonymized}
          </p>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {anonymization.piiRemovedCount} ocorrências removidas nesta demonstração
            </div>

            <button disabled className="btn-primary text-xs py-2 px-3">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Envio indisponível no modo demo</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import React from 'react';

export interface PsicologoVitrineItem {
  id: string;
  nome: string;
  nomeSocial?: string;
  crp: string;
  estadoUf?: string;
  cidade?: string;
  fotoUrl?: string;
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  especialidades: string[];
  servicosHabilitados: string[];
}

interface VitrineCarrosselProps {
  psicologos: PsicologoVitrineItem[];
}

export function VitrineCarrossel({ psicologos }: VitrineCarrosselProps) {
  if (!psicologos || psicologos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px]">Corpo Clínico Credenciado</span>
          <h3 className="text-2xl sm:text-3xl font-black text-ink mt-1">Conheça Nossos Psicólogos</h3>
          <p className="text-xs text-muted">Profissionais especializados e em supervisão contínua</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {psicologos.map((psi) => (
          <div
            key={psi.id}
            className="bg-surface rounded-3xl border border-psi-soft p-6 space-y-4 shadow-card hover:shadow-lift transition-all group overflow-hidden relative flex flex-col justify-between"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {psi.fotoUrl ? (
                  <img
                    src={psi.fotoUrl}
                    alt={psi.nomeSocial || psi.nome}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-psi-vibrant shadow-sm"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-psi-soft text-psi-deep font-black text-xl flex items-center justify-center border border-psi-vibrant/30">
                    {(psi.nomeSocial || psi.nome).substring(0, 2).toUpperCase()}
                  </div>
                )}

                <div>
                  <h4 className="font-black text-base text-ink group-hover:text-psi-vibrant transition-colors">
                    {psi.nomeSocial || psi.nome}
                  </h4>
                  <span className="text-xs font-mono font-bold text-psi-vibrant block">{psi.crp}</span>
                </div>
              </div>

              {psi.posGraduacaoViverMais && (
                <div className="text-xs text-muted space-y-1 border-t border-line pt-3">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-psi-vibrant block">
                    Pós-Graduação Viver Mais
                  </span>
                  <p className="font-semibold text-ink text-[11px] leading-snug">{psi.posGraduacaoViverMais}</p>
                </div>
              )}

              {psi.servicosHabilitados && psi.servicosHabilitados.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {psi.servicosHabilitados.map((s, idx) => (
                    <span
                      key={idx}
                      className="bg-slate-100 text-slate-700 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border border-slate-200"
                    >
                      {s === 'PSICOTERAPIA'
                        ? 'Psicoterapia'
                        : s === 'AVALIACAO'
                        ? 'Avaliação Psicológica'
                        : s === 'ORIENTACAO_PROFISSIONAL'
                        ? 'Orientação Profissional'
                        : 'Orientação Parental'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

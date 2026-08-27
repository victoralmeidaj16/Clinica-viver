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
  turnosDisponiveis?: string[];
  modalidadesAtendidas?: string[];
  disponivelParaNovosPacientes?: boolean;
}

interface VitrineCarrosselProps {
  psicologos: PsicologoVitrineItem[];
  onSelecionar?: (psicologo: PsicologoVitrineItem) => void;
  selecionadoId?: string;
}

function FotoOuIniciais({ fotoUrl, nome }: { fotoUrl?: string; nome: string }) {
  const [erro, setErro] = React.useState(false);
  const iniciais = (nome || 'Psi')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || 'PS';

  if (fotoUrl && !erro) {
    return (
      <img
        src={fotoUrl}
        alt={nome}
        onError={() => setErro(true)}
        className="w-16 h-16 rounded-2xl object-cover border-2 border-psi-vibrant shadow-sm shrink-0"
      />
    );
  }

  return (
    <div className="w-16 h-16 rounded-2xl bg-psi-soft text-psi-deep font-black text-xl flex items-center justify-center border border-psi-vibrant/30 shrink-0 select-none">
      {iniciais}
    </div>
  );
}

const ROTULOS_TURNO: Record<string, string> = {
  MANHA: 'Manhã',
  MATUTINO: 'Manhã',
  TARDE: 'Tarde',
  VESPERTINO: 'Tarde',
  NOITE: 'Noite',
  NOTURNO: 'Noite',
};

export function VitrineCarrossel({ psicologos, onSelecionar, selecionadoId }: VitrineCarrosselProps) {
  if (!psicologos || psicologos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h3 className="text-2xl sm:text-3xl font-black text-ink">Conheça Nossos Profissionais</h3>
          <p className="text-xs text-muted">Profissionais especializados e em supervisão contínua</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {psicologos.map((psi) => {
          const nomeExibicao = psi.nomeSocial?.trim() || psi.nome;
          return (
            <div
              key={psi.id}
              className={`bg-surface rounded-3xl border p-6 space-y-4 shadow-card hover:shadow-lift transition-all group overflow-hidden relative flex flex-col justify-between ${
                selecionadoId === psi.id ? 'border-psi-vibrant ring-2 ring-psi-vibrant/20' : 'border-psi-soft'
              }`}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <FotoOuIniciais fotoUrl={psi.fotoUrl} nome={nomeExibicao} />

                  <div>
                    <h4 className="font-black text-base text-ink group-hover:text-psi-vibrant transition-colors">
                      {nomeExibicao}
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

                {onSelecionar && (psi.turnosDisponiveis?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                    <span className="w-full text-[10px] font-extrabold uppercase tracking-wider text-muted">Períodos disponíveis</span>
                    {[...new Set(psi.turnosDisponiveis?.map((turno) => ROTULOS_TURNO[turno] ?? turno))].map((turno) => (
                      <span key={turno} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 border border-emerald-100">
                        {turno}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {onSelecionar && (
                <button
                  type="button"
                  onClick={() => onSelecionar(psi)}
                  className={`w-full rounded-xl px-4 py-3 text-xs font-black transition-all ${
                    selecionadoId === psi.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-psi-deep text-white hover:bg-psi-darkest'
                  }`}
                >
                  {selecionadoId === psi.id ? 'Profissional escolhido' : 'Escolher este profissional'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

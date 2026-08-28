'use client';

import React, { useState, useMemo } from 'react';
import { Search, X, Filter, Sparkles, Heart, Clock, User, Check } from 'lucide-react';
import { LISTA_NECESSIDADES } from '@/components/forms/necessidades';

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
  publicoAlvo?: string[];
  necessidadesAtendidas?: string[];
  disponivelParaNovosPacientes?: boolean;
}

interface VitrineCarrosselProps {
  psicologos: PsicologoVitrineItem[];
  onSelecionar?: (psicologo: PsicologoVitrineItem) => void;
  selecionadoId?: string;
  titulo?: string;
  subtitulo?: string;
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

const PRINCIPAIS_DEMANDAS = [
  'Ansiedade',
  'Depressão',
  'Autoconhecimento',
  'Autoestima',
  'Relacionamentos',
  'Estresse / Burnout',
  'Luto',
];

export function VitrineCarrossel({
  psicologos,
  onSelecionar,
  selecionadoId,
  titulo = 'Conheça Nossos Profissionais',
  subtitulo = 'Profissionais especializados e com registro ativo no CRP',
}: VitrineCarrosselProps) {
  const [buscaNome, setBuscaNome] = useState('');
  const [demandaSelecionada, setDemandaSelecionada] = useState<string>('');
  const [turnoSelecionado, setTurnoSelecionado] = useState<string>('');
  const [publicoSelecionado, setPublicoSelecionado] = useState<string>('');

  const temFiltroAtivo = Boolean(
    buscaNome.trim() || demandaSelecionada || turnoSelecionado || publicoSelecionado
  );

  const limparFiltros = () => {
    setBuscaNome('');
    setDemandaSelecionada('');
    setTurnoSelecionado('');
    setPublicoSelecionado('');
  };

  const psicologosFiltrados = useMemo(() => {
    if (!psicologos || psicologos.length === 0) return [];

    return psicologos.filter((psi) => {
      const nomeExibicao = (psi.nomeSocial?.trim() || psi.nome).toLowerCase();
      const crp = (psi.crp || '').toLowerCase();

      // Filtro por Nome ou CRP
      if (buscaNome.trim()) {
        const termo = buscaNome.toLowerCase().trim();
        if (!nomeExibicao.includes(termo) && !crp.includes(termo)) {
          return false;
        }
      }

      // Filtro por Demanda
      if (demandaSelecionada) {
        const normDemanda = demandaSelecionada.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const temDemanda = psi.necessidadesAtendidas?.some((nec) => {
          const normNec = nec.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          return normNec.includes(normDemanda) || normDemanda.includes(normNec);
        });
        // Se o profissional não especificou demandas, consideramos que atende demandas gerais
        if (psi.necessidadesAtendidas && psi.necessidadesAtendidas.length > 0 && !temDemanda) {
          return false;
        }
      }

      // Filtro por Turno
      if (turnoSelecionado) {
        const turnosNorm = (psi.turnosDisponiveis || []).map((t) => (ROTULOS_TURNO[t] || t).toUpperCase());
        if (!turnosNorm.includes(turnoSelecionado.toUpperCase())) {
          return false;
        }
      }

      // Filtro por Público
      if (publicoSelecionado) {
        const normPublico = publicoSelecionado.toLowerCase();
        const temPublico = psi.publicoAlvo?.some((p) => p.toLowerCase().includes(normPublico));
        if (psi.publicoAlvo && psi.publicoAlvo.length > 0 && !temPublico) {
          return false;
        }
      }

      return true;
    });
  }, [psicologos, buscaNome, demandaSelecionada, turnoSelecionado, publicoSelecionado]);

  if (!psicologos || psicologos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho e Barra de Filtros */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h3 className="text-2xl sm:text-3xl font-black text-ink">{titulo}</h3>
            <p className="text-xs text-muted mt-1">{subtitulo}</p>
          </div>
          <span className="text-xs font-bold text-psi-deep bg-psi-soft/80 px-3 py-1.5 rounded-xl border border-psi-soft self-start sm:self-auto">
            {psicologosFiltrados.length} {psicologosFiltrados.length === 1 ? 'profissional encontrado' : 'profissionais encontrados'}
          </span>
        </div>

        {/* Barra de Busca e Filtros Rápidos */}
        <div className="bg-surface p-4 sm:p-5 rounded-3xl border border-psi-soft shadow-card space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Campo de Busca por Nome */}
            <div className="md:col-span-6 relative">
              <Search className="w-4 h-4 text-muted absolute left-3.5 top-3.5 pointer-events-none" />
              <input
                type="text"
                value={buscaNome}
                onChange={(e) => setBuscaNome(e.target.value)}
                placeholder="Buscar por nome do psicólogo ou CRP..."
                className="w-full pl-10 pr-9 py-2.5 bg-canvas border border-line rounded-2xl text-xs text-ink placeholder:text-muted focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/10"
              />
              {buscaNome && (
                <button
                  type="button"
                  onClick={() => setBuscaNome('')}
                  className="absolute right-3 top-3 text-muted hover:text-ink p-0.5"
                  aria-label="Limpar busca"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown de Demanda */}
            <div className="md:col-span-3">
              <select
                value={demandaSelecionada}
                onChange={(e) => setDemandaSelecionada(e.target.value)}
                className="w-full py-2.5 px-3 bg-canvas border border-line rounded-2xl text-xs text-ink focus:outline-none focus:border-psi-vibrant font-medium"
              >
                <option value="">Todas as demandas clínicas</option>
                {PRINCIPAIS_DEMANDAS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown de Turno */}
            <div className="md:col-span-3">
              <select
                value={turnoSelecionado}
                onChange={(e) => setTurnoSelecionado(e.target.value)}
                className="w-full py-2.5 px-3 bg-canvas border border-line rounded-2xl text-xs text-ink focus:outline-none focus:border-psi-vibrant font-medium"
              >
                <option value="">Todos os períodos</option>
                <option value="MANHA">Manhã</option>
                <option value="TARDE">Tarde</option>
                <option value="NOITE">Noite</option>
              </select>
            </div>
          </div>

          {/* Chips de Demandas Frequentes para Filtro em 1-Clique */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-line/60">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted flex items-center gap-1 shrink-0">
              <Filter className="w-3 h-3 text-psi-vibrant" /> Filtros rápidos:
            </span>
            {PRINCIPAIS_DEMANDAS.slice(0, 5).map((demanda) => {
              const ativo = demandaSelecionada === demanda;
              return (
                <button
                  key={demanda}
                  type="button"
                  onClick={() => setDemandaSelecionada(ativo ? '' : demanda)}
                  className={`text-[11px] font-extrabold px-2.5 py-1 rounded-xl border transition-all ${
                    ativo
                      ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                      : 'bg-canvas text-muted border-line hover:border-psi-soft hover:text-ink'
                  }`}
                >
                  {demanda}
                </button>
              );
            })}

            {temFiltroAtivo && (
              <button
                type="button"
                onClick={limparFiltros}
                className="text-[11px] font-extrabold text-rose-600 hover:text-rose-800 ml-auto flex items-center gap-1 hover:underline"
              >
                <X className="w-3 h-3" /> Limpar filtros
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grade de Profissionais */}
      {psicologosFiltrados.length === 0 ? (
        <div className="bg-surface rounded-3xl border border-line p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
            <User className="w-6 h-6" />
          </div>
          <h4 className="text-base font-black text-ink">Nenhum profissional encontrado para estes filtros</h4>
          <p className="text-xs text-muted max-w-md mx-auto">
            Tente remover alguns filtros ou utilize a recomendação inteligente para que nosso sistema encontre o melhor psicólogo para você.
          </p>
          <button
            type="button"
            onClick={limparFiltros}
            className="bg-psi-deep hover:bg-psi-darkest text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all"
          >
            Ver todos os profissionais
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {psicologosFiltrados.map((psi) => {
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

                  {/* Demandas Atendidas pelo Psicólogo */}
                  {psi.necessidadesAtendidas && psi.necessidadesAtendidas.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {psi.necessidadesAtendidas.slice(0, 3).map((demanda, idx) => (
                        <span
                          key={idx}
                          className="bg-purple-50 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-100"
                        >
                          {demanda}
                        </span>
                      ))}
                      {psi.necessidadesAtendidas.length > 3 && (
                        <span className="text-[10px] text-muted font-bold self-center">
                          +{psi.necessidadesAtendidas.length - 3} mais
                        </span>
                      )}
                    </div>
                  )}

                  {/* Períodos disponíveis */}
                  {(psi.turnosDisponiveis?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
                      <span className="w-full text-[10px] font-extrabold uppercase tracking-wider text-muted">
                        Períodos disponíveis
                      </span>
                      {[...new Set(psi.turnosDisponiveis?.map((turno) => ROTULOS_TURNO[turno] ?? turno))].map((turno) => (
                        <span
                          key={turno}
                          className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold text-emerald-800 border border-emerald-100"
                        >
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
                    className={`w-full rounded-xl px-4 py-3 text-xs font-black transition-all mt-4 ${
                      selecionadoId === psi.id
                        ? 'bg-emerald-600 text-white shadow-md'
                        : 'bg-psi-deep text-white hover:bg-psi-darkest'
                    }`}
                  >
                    {selecionadoId === psi.id ? 'Profissional Escolhido ✓' : 'Escolher este profissional'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

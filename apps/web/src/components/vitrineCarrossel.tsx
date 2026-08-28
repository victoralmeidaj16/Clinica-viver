'use client';

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  Search,
  X,
  Filter,
  User,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Users,
  Clock,
} from 'lucide-react';

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
  /** Exibe a barra de busca e filtros. Usado apenas na etapa de escolha do profissional. */
  mostrarFiltros?: boolean;
  /** 'lista' empilha os profissionais em uma secao vertical no lugar do carrossel horizontal. */
  layout?: 'carrossel' | 'lista';
}

function FotoOuIniciais({
  fotoUrl,
  nome,
  className = 'w-16 h-16 rounded-2xl',
}: {
  fotoUrl?: string;
  nome: string;
  className?: string;
}) {
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
        className={`${className} object-cover border-2 border-psi-vibrant shadow-sm shrink-0`}
      />
    );
  }

  return (
    <div className={`${className} bg-psi-soft text-psi-deep font-black text-xl flex items-center justify-center border border-psi-vibrant/30 shrink-0 select-none`}>
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

const ROTULOS_SERVICO: Record<string, string> = {
  PSICOTERAPIA: 'Psicoterapia',
  AVALIACAO: 'Avaliação Psicológica',
  ORIENTACAO_PROFISSIONAL: 'Orientação Profissional',
  ORIENTACAO_PARENTAL: 'Orientação Parental',
};

interface CardPsicologoLinhaProps {
  psi: PsicologoVitrineItem;
  selecionado: boolean;
  onSelecionar?: (psicologo: PsicologoVitrineItem) => void;
}

/**
 * Versão em linha do card, usada quando os profissionais são listados na
 * vertical: a foto fica à esquerda e os dados ocupam a largura toda, em vez de
 * espremidos na coluna estreita que o carrossel exige.
 */
function CardPsicologoLinha({ psi, selecionado, onSelecionar }: CardPsicologoLinhaProps) {
  const nomeExibicao = psi.nomeSocial?.trim() || psi.nome;
  const local = [psi.cidade, psi.estadoUf].filter(Boolean).join(' - ');
  const turnos = [...new Set(psi.turnosDisponiveis?.map((turno) => ROTULOS_TURNO[turno] ?? turno) ?? [])];
  const servicos = psi.servicosHabilitados?.map((servico) => ROTULOS_SERVICO[servico] ?? servico) ?? [];

  return (
    <article
      className={`bg-surface rounded-3xl border p-5 shadow-card transition-all hover:shadow-lift sm:p-7 ${
        selecionado
          ? 'border-psi-vibrant ring-2 ring-psi-vibrant/20 bg-purple-50/20'
          : 'border-psi-soft'
      }`}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:gap-7">
        <FotoOuIniciais
          fotoUrl={psi.fotoUrl}
          nome={nomeExibicao}
          className="h-24 w-24 rounded-full sm:h-28 sm:w-28"
        />

        <div className="min-w-0 flex-1 space-y-4">
          {/* Identificação, com a localidade à direita como na referência */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0">
              <h4 className="text-lg font-black text-psi-deep sm:text-xl">{nomeExibicao}</h4>
              {psi.posGraduacaoViverMais && (
                <p className="mt-0.5 text-xs text-muted sm:text-sm">{psi.posGraduacaoViverMais}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-psi-vibrant">CRP {psi.crp}</span>
                <span className="inline-flex items-center rounded-md border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                  <ShieldCheck className="mr-0.5 h-2.5 w-2.5" /> Ativo
                </span>
              </div>
            </div>

            {local && (
              <span className="shrink-0 text-xs font-bold text-psi-deep sm:text-sm">{local}</span>
            )}
          </div>

          <div className="space-y-2 border-t border-line pt-4">
            {servicos.length > 0 && (
              <div className="flex flex-wrap items-start gap-2 text-xs">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-psi-vibrant" />
                <span className="font-semibold text-ink">{servicos.join(', ')}</span>
              </div>
            )}

            {(psi.necessidadesAtendidas?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-start gap-2 text-xs">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-psi-vibrant" />
                <span className="text-ink">{psi.necessidadesAtendidas?.join(', ')}</span>
              </div>
            )}

            {(psi.publicoAlvo?.length ?? 0) > 0 && (
              <div className="flex flex-wrap items-start gap-2 text-xs">
                <Users className="mt-0.5 h-4 w-4 shrink-0 text-psi-vibrant" />
                <span className="text-ink">{psi.publicoAlvo?.join(', ')}</span>
              </div>
            )}

            {turnos.length > 0 && (
              <div className="flex flex-wrap items-start gap-2 text-xs">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-psi-vibrant" />
                <span className="text-ink">{turnos.join(', ')}</span>
              </div>
            )}
          </div>

          {onSelecionar ? (
            <button
              type="button"
              onClick={() => onSelecionar(psi)}
              className={`rounded-xl px-6 py-3 text-xs font-black transition-all ${
                selecionado
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-psi-deep text-white hover:bg-psi-darkest'
              }`}
            >
              {selecionado ? 'Profissional Escolhido ✓' : 'Escolher este profissional'}
            </button>
          ) : (
            <a
              href="#servicos"
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-psi-soft px-6 py-3 text-xs font-black text-psi-darkest transition-all hover:bg-purple-200"
            >
              <span>Agendar Consulta</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

interface CardPsicologoProps {
  psi: PsicologoVitrineItem;
  selecionado: boolean;
  onSelecionar?: (psicologo: PsicologoVitrineItem) => void;
  className?: string;
}

function CardPsicologo({ psi, selecionado, onSelecionar, className = '' }: CardPsicologoProps) {
  const nomeExibicao = psi.nomeSocial?.trim() || psi.nome;

  return (
    <div
      className={`bg-surface rounded-3xl border p-6 flex flex-col justify-between shadow-card hover:shadow-lift transition-all group overflow-hidden relative ${
        selecionado
          ? 'border-psi-vibrant ring-2 ring-psi-vibrant/20 bg-purple-50/20'
          : 'border-psi-soft'
      } ${className}`}
    >
      <div className="space-y-4">
        {/* Topo do Card: Foto, Nome e CRP */}
        <div className="flex items-center gap-4">
          <FotoOuIniciais fotoUrl={psi.fotoUrl} nome={nomeExibicao} />

          <div className="min-w-0 flex-1">
            <h4 className="font-black text-base text-ink group-hover:text-psi-vibrant transition-colors truncate">
              {nomeExibicao}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs font-mono font-bold text-psi-vibrant">
                {psi.crp}
              </span>
              <span className="inline-flex items-center text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-100">
                <ShieldCheck className="w-2.5 h-2.5 mr-0.5" /> Ativo
              </span>
            </div>
          </div>
        </div>

        {/* Destaque Pós-Graduação Viver Mais */}
        {psi.posGraduacaoViverMais && (
          <div className="text-xs text-muted space-y-1 border-t border-line pt-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-psi-vibrant block">
              Pós-Graduação Viver Mais
            </span>
            <p className="font-semibold text-ink text-[11px] leading-snug line-clamp-2">
              {psi.posGraduacaoViverMais}
            </p>
          </div>
        )}

        {/* Serviços Habilitados */}
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
          <div className="space-y-1.5 border-t border-line/60 pt-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted block">
              Foco de atuação clínica
            </span>
            <div className="flex flex-wrap gap-1">
              {psi.necessidadesAtendidas.slice(0, 3).map((demanda, idx) => (
                <span
                  key={idx}
                  className="bg-purple-50 text-purple-900 text-[10px] font-bold px-2 py-0.5 rounded-md border border-purple-100"
                >
                  {demanda}
                </span>
              ))}
              {psi.necessidadesAtendidas.length > 3 && (
                <span className="text-[10px] text-muted font-bold self-center px-1">
                  +{psi.necessidadesAtendidas.length - 3}
                </span>
              )}
            </div>
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

      {/* Ações do Card */}
      <div className="pt-4 border-t border-line/60 mt-4">
        {onSelecionar ? (
          <button
            type="button"
            onClick={() => onSelecionar(psi)}
            className={`w-full rounded-xl px-4 py-3 text-xs font-black transition-all ${
              selecionado
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-psi-deep text-white hover:bg-psi-darkest'
            }`}
          >
            {selecionado ? 'Profissional Escolhido ✓' : 'Escolher este profissional'}
          </button>
        ) : (
          <a
            href="#servicos"
            className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-black bg-psi-soft text-psi-darkest hover:bg-purple-200 transition-all text-center"
          >
            <span>Agendar Consulta</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

export function VitrineCarrossel({
  psicologos,
  onSelecionar,
  selecionadoId,
  titulo = 'Conheça Nossos Profissionais',
  subtitulo = 'Profissionais especializados e com registro ativo no CRP',
  mostrarFiltros = false,
  layout = 'carrossel',
}: VitrineCarrosselProps) {
  const [buscaNome, setBuscaNome] = useState('');
  const [demandaSelecionada, setDemandaSelecionada] = useState<string>('');
  const [turnoSelecionado, setTurnoSelecionado] = useState<string>('');
  const [publicoSelecionado, setPublicoSelecionado] = useState<string>('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // Estados para Drag-to-scroll com o mouse
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeftStart = useRef(0);

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

  // Atualizar estado de scroll e setas de navegação
  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;

    setCanScrollLeft(scrollLeft > 5);
    setCanScrollRight(scrollLeft < maxScroll - 5);

    if (maxScroll > 0) {
      setScrollProgress(Math.min(100, Math.max(0, (scrollLeft / maxScroll) * 100)));
    } else {
      setScrollProgress(0);
    }
  }, []);

  useEffect(() => {
    updateScrollState();
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollState, { passive: true });
      window.addEventListener('resize', updateScrollState);
      return () => {
        el.removeEventListener('scroll', updateScrollState);
        window.removeEventListener('resize', updateScrollState);
      };
    }
  }, [psicologosFiltrados, updateScrollState]);

  // Resetar scroll quando os filtros mudam
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [buscaNome, demandaSelecionada, turnoSelecionado, publicoSelecionado]);

  const rolarParaEsquerda = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -360, behavior: 'smooth' });
    }
  };

  const rolarParaDireita = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 360, behavior: 'smooth' });
    }
  };

  // Handlers para arrastar com o mouse (Drag to scroll)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    isDragging.current = true;
    startX.current = e.pageX - scrollContainerRef.current.offsetLeft;
    scrollLeftStart.current = scrollContainerRef.current.scrollLeft;
  };

  const handleMouseLeaveOrUp = () => {
    isDragging.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX.current) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftStart.current - walk;
  };

  if (!psicologos || psicologos.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho com Título, Contador e Controles de Navegação do Carrossel */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          {/* Na lista a própria página já titula a seção; repetir aqui duplicaria o cabeçalho. */}
          {layout === 'carrossel' && (
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-psi-vibrant flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Equipe Clínica Credenciada
                </span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-black text-ink mt-1">{titulo}</h3>
              <p className="text-xs text-muted mt-1">{subtitulo}</p>
            </div>
          )}

          <div className="flex items-center gap-3 self-start sm:ml-auto sm:self-auto">
            <span className="text-xs font-bold text-psi-deep bg-psi-soft/80 px-3 py-1.5 rounded-xl border border-psi-soft">
              {psicologosFiltrados.length} {psicologosFiltrados.length === 1 ? 'profissional' : 'profissionais'}
            </span>

            {/* Botões de Rolagem Horizontal */}
            {layout === 'carrossel' && (
              <div className="flex items-center gap-1.5 bg-surface p-1 rounded-2xl border border-line shadow-xs">
                <button
                  type="button"
                  onClick={rolarParaEsquerda}
                  disabled={!canScrollLeft}
                  aria-label="Rolar profissionais para a esquerda"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-ink hover:bg-psi-soft disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={rolarParaDireita}
                  disabled={!canScrollRight}
                  aria-label="Rolar profissionais para a direita"
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-ink hover:bg-psi-soft disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Barra de Busca e Filtros Rápidos (apenas na etapa de escolha do profissional) */}
        {mostrarFiltros && (
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
        )}
      </div>

      {/* CARROSSEL HORIZONTAL DE PROFISSIONAIS */}
      {psicologosFiltrados.length === 0 ? (
        <div className="bg-surface rounded-3xl border border-line p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto border border-amber-200">
            <User className="w-6 h-6" />
          </div>
          <h4 className="text-base font-black text-ink">
            {temFiltroAtivo
              ? 'Nenhum profissional encontrado para estes filtros'
              : 'Nenhum profissional disponível no momento'}
          </h4>
          <p className="text-xs text-muted max-w-md mx-auto">
            {temFiltroAtivo
              ? 'Tente remover alguns filtros ou utilize a recomendação inteligente para que nosso sistema encontre o melhor psicólogo para você.'
              : 'Utilize a recomendação inteligente para que nosso sistema encontre o melhor psicólogo para você.'}
          </p>
          {temFiltroAtivo && (
            <button
              type="button"
              onClick={limparFiltros}
              className="bg-psi-deep hover:bg-psi-darkest text-white text-xs font-extrabold px-4 py-2 rounded-xl transition-all"
            >
              Ver todos os profissionais
            </button>
          )}
        </div>
      ) : layout === 'lista' ? (
        <div className="space-y-4">
          {psicologosFiltrados.map((psi) => (
            <CardPsicologoLinha
              key={psi.id}
              psi={psi}
              selecionado={selecionadoId === psi.id}
              onSelecionar={onSelecionar}
            />
          ))}
        </div>
      ) : (
        <div className="relative group/carrossel">
          {/* Botão Flutuante Esquerdo */}
          {canScrollLeft && (
            <button
              type="button"
              onClick={rolarParaEsquerda}
              aria-label="Rolar para a esquerda"
              className="absolute -left-3.5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 text-slate-800 shadow-xl border border-purple-100 flex items-center justify-center hover:scale-110 hover:bg-white transition-all hidden md:flex"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}

          {/* Botão Flutuante Direito */}
          {canScrollRight && (
            <button
              type="button"
              onClick={rolarParaDireita}
              aria-label="Rolar para a direita"
              className="absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white/95 text-slate-800 shadow-xl border border-purple-100 flex items-center justify-center hover:scale-110 hover:bg-white transition-all hidden md:flex"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}

          {/* Trilho Horizontal com Rolagem Suave e Snap */}
          <div
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeaveOrUp}
            onMouseUp={handleMouseLeaveOrUp}
            onMouseMove={handleMouseMove}
            className="flex gap-6 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar pb-4 pt-1 px-1 select-none cursor-grab active:cursor-grabbing"
          >
            {psicologosFiltrados.map((psi) => (
              <CardPsicologo
                key={psi.id}
                psi={psi}
                selecionado={selecionadoId === psi.id}
                onSelecionar={onSelecionar}
                className="w-[300px] sm:w-[330px] md:w-[350px] shrink-0 snap-start"
              />
            ))}
          </div>

          {/* Barra de Progresso / Indicador do Carrossel */}
          {psicologosFiltrados.length > 1 && (
            <div className="flex items-center justify-center gap-3 pt-3">
              <div className="w-32 sm:w-48 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-purple-600 rounded-full transition-all duration-150"
                  style={{ width: `${Math.max(15, scrollProgress)}%` }}
                />
              </div>
              <span className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Deslize para ver mais →
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

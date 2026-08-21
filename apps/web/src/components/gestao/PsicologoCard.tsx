import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock3,
  EyeOff,
  Eye,
  RotateCcw,
  PauseCircle,
  PlayCircle,
  SlidersHorizontal,
  Edit3,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { rotuloModalidade, rotuloTipoAtendimento, rotuloTurno } from '@/components/forms/opcoesPsicologo';
import { formatBrazilPhone } from '@/lib/brazilPhone';
import { formatGender } from '@/lib/gender';
import { PsicologoItem } from './types';
import { SemaforoCredenciamento } from './SemaforoCredenciamento';

interface PsicologoCardProps {
  p: PsicologoItem;
  ocupado: string | null;
  onAprovar: (p: PsicologoItem) => void;
  onRecusar: (p: PsicologoItem) => void;
  onAlternarRodizio: (p: PsicologoItem) => void;
  onAlternarVitrine: (p: PsicologoItem) => void;
  onEditar: (p: PsicologoItem) => void;
  onAjustarLimite: (p: PsicologoItem) => void;
  onPriorizar: (p: PsicologoItem) => void;
}

const nomeExibido = (p: PsicologoItem) => p.nomeSocial?.trim() || p.nomeCompleto;

const botao =
  'text-[10px] font-extrabold px-2.5 py-1.5 rounded-lg border transition-all disabled:opacity-50 flex items-center gap-1';

export function PsicologoCard({
  p,
  ocupado,
  onAprovar,
  onRecusar,
  onAlternarRodizio,
  onAlternarVitrine,
  onEditar,
  onAjustarLimite,
  onPriorizar,
}: PsicologoCardProps) {
  const [expanded, setExpanded] = useState(false);

  const limite = p.limitePacientesAtivos ?? 5;
  const ativos = p.pacientesAtivosCount ?? 0;
  const perc = limite > 0 ? Math.min(100, Math.round((ativos / limite) * 100)) : 0;
  const naVitrine = p.exibirNaVitrine !== false;
  const pausado = Boolean(p.pausadoNoRodizio);
  const semTurno = !p.turnosDisponiveis?.length;
  const trabalhando = ocupado === p.id;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4">
      {/* Minimized View Header */}
      <div className="space-y-4">
        <div
          onClick={() => setExpanded(!expanded)}
          className="flex items-start justify-between gap-3 cursor-pointer group select-none"
        >
          <div className="flex items-start gap-3.5 min-w-0">
            {p.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.fotoUrl}
                alt={`Foto de ${nomeExibido(p)}`}
                className="w-12 h-12 rounded-2xl object-cover border-2 border-purple-200 shrink-0"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 font-black text-lg flex items-center justify-center border-2 border-purple-200 shrink-0">
                {nomeExibido(p).charAt(0)}
              </div>
            )}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200">
                  Turma {p.turmaViverMais || '—'}
                </span>

                {p.status === 'EM_ANALISE' ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock3 className="w-3 h-3" /> Em análise
                  </span>
                ) : p.status === 'RECUSADO' ? (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200">
                    <XCircle className="w-3 h-3" /> Recusado
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        pausado
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                      title={pausado ? 'Não recebe encaminhamento' : 'Recebe encaminhamento'}
                    >
                      {pausado ? <PauseCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                      {pausado ? 'Pausado' : 'No rodízio'}
                    </span>
                    {!naVitrine && (
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 bg-slate-100 text-slate-600 border border-slate-200"
                        title="Não aparece no site público"
                      >
                        <EyeOff className="w-3 h-3" /> Oculto
                      </span>
                    )}
                  </div>
                )}
              </div>

              <h3 className="font-extrabold text-slate-900 text-base leading-snug truncate mt-1 group-hover:text-purple-700 transition-colors">
                {nomeExibido(p)}
              </h3>
              <p className="text-xs text-slate-500 font-medium">CRP {p.crp}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1.5 text-slate-400 hover:text-purple-700 hover:bg-purple-50 rounded-xl transition-all shrink-0 mt-0.5"
            title={expanded ? 'Recolher informações' : 'Expandir informações'}
          >
            {expanded ? <ChevronUp className="w-5 h-5 text-purple-700" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>

        {/* Minimized Content: Turnos, Pós, Último lead, Serviços Prestados, Público Alvo, Demandas atendidas */}
        <div className="space-y-2.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500">Turnos:</span>
            <span className="font-semibold text-slate-800">
              {p.turnosDisponiveis?.length ? p.turnosDisponiveis.map(rotuloTurno).join(', ') : 'Nenhum'}
            </span>
          </div>

          {p.posGraduacaoViverMais && (
            <div className="flex items-start justify-between gap-2">
              <span className="font-bold text-slate-500 shrink-0">Pós:</span>
              <span className="font-semibold text-slate-800 text-right">
                {p.posGraduacaoViverMais}
                {p.segundaPosGraduacao ? ` · ${p.segundaPosGraduacao}` : ''}
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-500">Último lead:</span>
            <span className="font-semibold text-slate-800">
              {p.ultimoLeadRecebidoEm
                ? new Date(p.ultimoLeadRecebidoEm).toLocaleDateString('pt-BR')
                : 'Nunca — primeiro da fila'}
            </span>
          </div>

          {Boolean(p.servicosPrestados?.length) && (
            <div className="space-y-1 pt-0.5">
              <span className="text-[11px] font-bold text-slate-500 block">Serviços Prestados:</span>
              <div className="flex flex-wrap gap-1">
                {p.servicosPrestados?.map((s) => (
                  <span
                    key={s}
                    className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Boolean(p.publicoAlvo?.length || p.publicoAlvoOutro) && (
            <div className="space-y-1 pt-0.5">
              <span className="text-[11px] font-bold text-slate-500 block">Público Alvo:</span>
              <div className="flex flex-wrap gap-1">
                {[...(p.publicoAlvo ?? []), ...(p.publicoAlvoOutro ? [p.publicoAlvoOutro] : [])].map((pa) => (
                  <span
                    key={pa}
                    className="text-[10px] font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-100"
                  >
                    {pa}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Boolean(p.necessidadesAtendidas?.length || p.necessidadesOutro) && (
            <div className="space-y-1 pt-0.5">
              <span className="text-[11px] font-bold text-slate-500 block">Demandas atendidas:</span>
              <div className="flex flex-wrap gap-1">
                {[...(p.necessidadesAtendidas ?? []), ...(p.necessidadesOutro ? [p.necessidadesOutro] : [])].map(
                  (n) => (
                    <span
                      key={n}
                      className="text-[10px] font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-100"
                    >
                      {n}
                    </span>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Maximized / Expanded Details */}
        {expanded && (
          <div className="space-y-4 border-t border-slate-200 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
            {pausado && (
              <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
                Não recebe encaminhamento: {p.motivoPausaRodizio ?? 'sem motivo registrado'}
              </p>
            )}

            {!naVitrine && (
              <p className="text-[11px] font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                Fora do site público: {p.motivoDesativacao ?? 'sem motivo registrado'}
              </p>
            )}

            {semTurno && p.status === 'APROVADO' && !pausado && (
              <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                Sem turno cadastrado — não recebe encaminhamento, mesmo estando no rodízio.
              </p>
            )}

            {p.status !== 'RECUSADO' && <SemaforoCredenciamento psicologo={p} />}

            <div className="space-y-2 text-xs text-slate-600 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Localidade:</span>
                <span className="font-semibold text-slate-800">
                  {p.cidade && p.estadoUf ? `${p.cidade}/${p.estadoUf}` : '—'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">Endereço:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {[p.logradouro, p.bairro].filter(Boolean).join(' — ') || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Gênero:</span>
                <span className="font-semibold text-slate-800">
                  {formatGender(p.genero, p.generoOutro) || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Atendimento:</span>
                <span className="font-extrabold text-purple-900">
                  {rotuloTipoAtendimento(p.atendimentoPreferencia)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Modalidade:</span>
                <span className="font-semibold text-slate-800">
                  {rotuloModalidade(p.modalidadeAtendimento)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">Especialidade:</span>
                <span className="font-semibold text-slate-800 text-right">{p.especialidade || '—'}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">E-mail:</span>
                <span className="font-semibold text-slate-800 text-right break-all">{p.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">WhatsApp:</span>
                <a
                  href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-600 font-bold hover:underline"
                >
                  {formatBrazilPhone(p.whatsapp) || p.whatsapp}
                </a>
              </div>
            </div>

            {p.minibio && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-500 block">Apresentação:</span>
                <p className="text-[11px] text-slate-600 leading-5 bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2">
                  {p.minibio}
                </p>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600">Capacidade</span>
                <span className="font-black text-slate-900">
                  {ativos} / {limite} pacientes
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                <div
                  className={`h-full transition-all ${
                    perc >= 100 ? 'bg-rose-500' : perc >= 75 ? 'bg-amber-500' : 'bg-purple-600'
                  }`}
                  style={{ width: `${perc}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
              <button
                disabled={trabalhando}
                onClick={() => onEditar(p)}
                title="Editar todos os campos cadastrais, localização, formação e critérios de rodízio"
                className={`${botao} bg-purple-50 border-purple-200 text-purple-900 font-bold hover:bg-purple-100`}
              >
                <Edit3 className="w-3 h-3 text-purple-700" /> Editar Cadastro
              </button>

              {p.status === 'EM_ANALISE' ? (
                <>
                  <button
                    disabled={trabalhando}
                    onClick={() => void onAprovar(p)}
                    className={`${botao} bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100`}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Aprovar acesso
                  </button>
                  <button
                    disabled={trabalhando}
                    onClick={() => void onRecusar(p)}
                    className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                  >
                    <XCircle className="w-3 h-3" /> Recusar
                  </button>
                </>
              ) : p.status === 'RECUSADO' ? (
                <button
                  disabled={trabalhando}
                  onClick={() => void onAprovar(p)}
                  className={`${botao} bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100`}
                >
                  <CheckCircle2 className="w-3 h-3" /> Reconsiderar
                </button>
              ) : (
                <>
                  <button
                    disabled={trabalhando}
                    onClick={() => onAlternarRodizio(p)}
                    title={
                      pausado
                        ? 'Volta a receber pacientes novos'
                        : 'Para de receber pacientes novos, sem sair do site'
                    }
                    className={`${botao} ${
                      pausado
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {pausado ? <PlayCircle className="w-3 h-3" /> : <PauseCircle className="w-3 h-3" />}
                    {pausado ? 'Retomar' : 'Pausar'}
                  </button>
                  <button
                    disabled={trabalhando}
                    onClick={() => onAlternarVitrine(p)}
                    title={
                      naVitrine
                        ? 'Some do site público, mas continua atendendo'
                        : 'Volta a aparecer no site público'
                    }
                    className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                  >
                    {naVitrine ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    {naVitrine ? 'Ocultar' : 'Exibir'}
                  </button>
                  <button
                    disabled={trabalhando}
                    onClick={() => void onAjustarLimite(p)}
                    className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                  >
                    Limite: {limite}
                  </button>
                  {!pausado && (
                    <button
                      disabled={trabalhando}
                      onClick={() => void onPriorizar(p)}
                      title="Coloca no início da fila do próximo encaminhamento"
                      className={`${botao} bg-white border-slate-200 text-slate-600 hover:bg-slate-50`}
                    >
                      <RotateCcw className="w-3 h-3" /> Priorizar
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

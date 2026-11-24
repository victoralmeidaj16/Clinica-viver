import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock3,
  PauseCircle,
  Bell,
  Plane,
  UserX,
  CalendarClock,
} from 'lucide-react';
import { foraPorVinculoAcademico, formatarDataCurta } from '@/lib/turmaEncerrada';
import { rotuloRestante } from '@/lib/turmasCiclo';
import { ausenciaEmCurso, periodoAusencia } from '@/lib/ausenciaAgenda';
import { rotuloTurno } from '@/components/forms/opcoesPsicologo';
import { PsicologoItem } from './types';
import { PsicologoCardDetalhes } from './PsicologoCardDetalhes';
import { VinculosAcademicosPainel } from './VinculosAcademicosPainel';
import { PsicologoCardAcoes } from './PsicologoCardAcoes';
import { BannerSolicitacaoAlteracaoGestao } from './BannerSolicitacaoAlteracaoGestao';
import { focoPsicologo } from '@/lib/focoNotificacao';
import { PsicologoPosicaoRodizio } from './PsicologoPosicaoRodizio';
import { TagStatus } from './TagStatus';

export interface PsicologoCardProps {
  /** Recarrega a lista depois de uma decisão sobre vínculo acadêmico. */
  onVinculoAlterado?: () => void | Promise<void>;
  p: PsicologoItem;
  ocupado: string | null;
  onAprovar: (p: PsicologoItem) => void;
  onRecusar: (p: PsicologoItem) => void;
  onAlternarRodizio: (p: PsicologoItem) => void;
  onEditar: (p: PsicologoItem) => void;
  onAjustarLimite: (p: PsicologoItem) => void;
  onPriorizar: (p: PsicologoItem) => void;
  onReenviarConvite: (p: PsicologoItem) => void;
  onAprovarSolicitacaoGestao?: (p: PsicologoItem) => void | Promise<void>;
  onRecusarSolicitacaoGestao?: (p: PsicologoItem) => void | Promise<void>;
}

const nomeExibido = (p: PsicologoItem) => p.nomeSocial?.trim() || p.nomeCompleto;

export function PsicologoCard({
  p,
  ocupado,
  onAprovar,
  onRecusar,
  onAlternarRodizio,
  onEditar,
  onAjustarLimite,
  onPriorizar,
  onReenviarConvite,
  onAprovarSolicitacaoGestao,
  onRecusarSolicitacaoGestao,
  onVinculoAlterado,
}: PsicologoCardProps) {
  const [expanded, setExpanded] = useState(false);

  const limite = p.limitePacientesAtivos ?? 5;
  const ativos = p.pacientesAtivosCount ?? 0;
  const perc = limite > 0 ? Math.min(100, Math.round((ativos / limite) * 100)) : 0;
  const pausado = Boolean(p.pausadoNoRodizio);
  const foraDoRodizio = p.rodizio ? p.rodizio.posicao === null : pausado;
  // Ausência e pausa manual são estados diferentes com o mesmo efeito. Mantê-los
  // separados é o que permite ao botão "Retomar" continuar respondendo só pela
  // pausa da gestão: retomar quem está de férias não faria nada, e prometer o
  // contrário no botão seria pior do que não oferecê-lo.
  // Um "agora" por montagem, não por render: as duas badges abaixo precisam
  // concordar entre si, e a resolução aqui é de dias — a lista é remontada a
  // cada recarga da gestão, que é de sobra para um período de férias.
  const [agora] = useState(() => new Date());
  const ausencia = ausenciaEmCurso(p.ausenciasAgenda, agora);
  const proximaAusencia = !ausencia
    ? p.ausenciasAgenda?.find((item) => Date.parse(item.inicio) > agora.getTime())
    : undefined;
  const encerramento = p.turmaEncerrada;
  // Fora só quando nenhum vínculo acadêmico aprovado continua válido (1.04).
  const desligado = foraPorVinculoAcademico(p);
  const emSaida = p.situacaoAcademica?.emSaida;
  const trabalhando = ocupado === p.id;
  const temSolicitacaoPendente = p.solicitacaoAlteracaoGestao?.status === 'PENDENTE';

  return (
    <div
      data-foco={focoPsicologo(p.id)}
      className="p-3 sm:p-3.5 hover:bg-slate-50/80 transition-colors space-y-2.5"
    >
      {/* Banner de Solicitação de Alteração da Gestão (se houver) */}
      {temSolicitacaoPendente && (
        <BannerSolicitacaoAlteracaoGestao
          psicologo={p}
          trabalhando={trabalhando}
          onAprovar={onAprovarSolicitacaoGestao ?? (() => {})}
          onRecusar={onRecusarSolicitacaoGestao ?? (() => {})}
          onEditar={onEditar}
        />
      )}
      {/* Linha Principal da Lista */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Coluna 1: Foto, Nome, Turma e Status */}
        <div className="flex items-center gap-3 min-w-0 lg:w-1/3">
          {p.fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.fotoUrl}
              alt={`Foto de ${nomeExibido(p)}`}
              className="w-10 h-10 rounded-xl object-cover border-2 border-purple-200 shrink-0 shadow-xs"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 font-black text-base flex items-center justify-center border-2 border-purple-200 shrink-0 shadow-xs">
              {nomeExibido(p).charAt(0)}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {emSaida?.saidaEm && (
                <TagStatus
                  icone={CalendarClock}
                  cor="atencao"
                  title={`Turma ${emSaida.turma} de ${emSaida.posGraduacao} encerrada. Sai da vitrine por este vínculo em ${formatarDataCurta(emSaida.saidaEm)}.`}
                >
                  Saída {formatarDataCurta(emSaida.saidaEm)} · {rotuloRestante(emSaida.diasRestantes ?? 0)}
                </TagStatus>
              )}

              {temSolicitacaoPendente && (
                <TagStatus icone={Bell} cor="marca">Alteração solicitada</TagStatus>
              )}

              {p.status === 'EM_ANALISE' ? (
                <TagStatus icone={Clock3} cor="atencao">Em análise</TagStatus>
              ) : p.status === 'RECUSADO' ? (
                <TagStatus icone={XCircle}>Recusado</TagStatus>
              ) : desligado ? (
                <TagStatus
                  icone={UserX}
                  cor="negativo"
                  title={encerramento
                    ? `Turma ${encerramento.turma} encerrada em ${formatarDataCurta(encerramento.encerradaEm)}${encerramento.saidaEm ? ` e fora da vitrine desde ${formatarDataCurta(encerramento.saidaEm)}` : ''}. Sem outro vínculo acadêmico válido. Reabra a turma ou prorrogue a saída para desfazer.`
                    : 'Nenhum vínculo acadêmico aprovado continua válido. Fora do rodízio e da vitrine.'}
                >
                  Fora · turma encerrada
                </TagStatus>
              ) : ausencia ? (
                <TagStatus
                  icone={Plane}
                  cor="ausente"
                  title={`Férias/folga marcadas na própria agenda${ausencia.motivo ? `: ${ausencia.motivo}` : ''}. Fora do rodízio até o fim do período.`}
                >
                  Ausente {periodoAusencia(ausencia)}
                </TagStatus>
              ) : (
                <TagStatus
                  icone={foraDoRodizio ? PauseCircle : CheckCircle2}
                  cor={foraDoRodizio ? 'negativo' : 'positivo'}
                  title={foraDoRodizio ? p.rodizio?.motivo ?? 'Pausado pela gestão' : 'Disponível para encaminhamentos compatíveis'}
                >
                  {foraDoRodizio ? (pausado ? 'Pausado' : 'Indisponível') : 'No rodízio'}
                </TagStatus>
              )}

              {proximaAusencia && p.status === 'APROVADO' && (
                <TagStatus
                  icone={Plane}
                  title={`Sai do rodízio automaticamente no período${proximaAusencia.motivo ? `: ${proximaAusencia.motivo}` : ''}.`}
                >
                  Folga {periodoAusencia(proximaAusencia)}
                </TagStatus>
              )}
            </div>

            {/*
              CRP e cidade saíram daqui para os detalhes: numa lista que a
              gestão percorre para achar quem pausar ou priorizar, eles não são
              o que se procura, e custavam uma linha em cada card.
            */}
            <h3 className="font-extrabold text-slate-900 text-sm leading-snug truncate mt-0.5">
              {nomeExibido(p)}
            </h3>
            <PsicologoPosicaoRodizio rodizio={p.rodizio} />
          </div>
        </div>

        {/* Coluna 2: Turnos & Capacidade */}
        <div className="flex items-center gap-6 lg:w-1/3 justify-between lg:justify-start">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Turnos</span>
            <span className="text-xs font-semibold text-slate-800 block">
              {p.turnosDisponiveis?.length ? p.turnosDisponiveis.map(rotuloTurno).join(', ') : 'Nenhum'}
            </span>
          </div>

          <div className="space-y-1 min-w-[120px]">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Capacidade</span>
              <button
                type="button"
                onClick={() => void onAjustarLimite(p)}
                className="font-extrabold text-purple-900 hover:underline text-xs"
                title="Ajustar limite de pacientes ativos"
              >
                {ativos}/{limite}
              </button>
            </div>
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  perc >= 100 ? 'bg-rose-500' : perc >= 75 ? 'bg-amber-500' : 'bg-purple-600'
                }`}
                style={{ width: `${perc}%` }}
              />
            </div>
          </div>
        </div>

        {/* Coluna 3: Ações e Botão de Expansão */}
        <PsicologoCardAcoes p={p} trabalhando={trabalhando} pausado={pausado} expanded={expanded}
          onToggleExpanded={() => setExpanded(!expanded)} onEditar={onEditar} onAprovar={onAprovar}
          onRecusar={onRecusar} onAlternarRodizio={onAlternarRodizio} onPriorizar={onPriorizar} />
      </div>

      {/* Detalhes Expandidos da Linha */}
      {expanded && (
        <>
          <PsicologoCardDetalhes p={p} trabalhando={trabalhando} onReenviarConvite={onReenviarConvite} />
          {onVinculoAlterado && <VinculosAcademicosPainel p={p} onAlterado={onVinculoAlterado} />}
        </>
      )}
    </div>
  );
}

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
import { PsicologoVisibilidadeVitrine, type AtualizarControlesPsicologo } from './PsicologoControles';
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
  onAtualizarControles: AtualizarControlesPsicologo;
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
  onAtualizarControles,
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

  const alternar = () => setExpanded((atual) => !atual);
  const colunas = 5;

  return (
    <>
      {/* Pedido de alteração pendente: aparece sem precisar expandir. */}
      {temSolicitacaoPendente && (
        <tr>
          <td colSpan={colunas} className="px-4 pt-4">
            <BannerSolicitacaoAlteracaoGestao
              psicologo={p}
              trabalhando={trabalhando}
              onAprovar={onAprovarSolicitacaoGestao ?? (() => {})}
              onRecusar={onRecusarSolicitacaoGestao ?? (() => {})}
              onEditar={onEditar}
            />
          </td>
        </tr>
      )}

      {/* A linha inteira expande os detalhes, como na Gestão de Pacientes. */}
      <tr
        data-foco={focoPsicologo(p.id)}
        onClick={alternar}
        className={`h-[76px] cursor-pointer align-middle transition-colors hover:bg-psi-soft/30 ${expanded ? 'bg-psi-soft/20' : ''}`}
      >
        <td className="px-3 py-3">
          <div className="flex items-center gap-3">
            {p.fotoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.fotoUrl} alt="" className="h-11 w-11 shrink-0 rounded-2xl border border-psi-soft object-cover" />
            ) : (
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-psi-soft bg-psi-soft/60 text-base font-black text-psi-deep">
                {nomeExibido(p).charAt(0)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-ink">{nomeExibido(p)}</p>
              <PsicologoPosicaoRodizio rodizio={p.rodizio} />
            </div>
          </div>
        </td>
        <td className="px-3 py-3">
        <div className="flex flex-wrap items-center gap-1">
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
          {p.status === 'APROVADO' && (
            <PsicologoVisibilidadeVitrine p={p} trabalhando={trabalhando} onAtualizar={onAtualizarControles} />
          )}
        </div>
        </td>
        <td className="whitespace-nowrap px-3 py-3 font-semibold text-ink">
          {p.turnosDisponiveis?.length ? p.turnosDisponiveis.map(rotuloTurno).join(', ') : 'Nenhum'}
        </td>
        <td className="px-3 py-3">
          <div className="min-w-[96px] space-y-1.5">
            <button
              type="button"
              onClick={(event) => { event.stopPropagation(); void onAjustarLimite(p); }}
              className="whitespace-nowrap font-bold text-ink hover:underline"
              title="Ajustar limite de pacientes ativos"
            >
              {ativos}/{limite} pacientes
            </button>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-psi-soft/60">
              <div
                className={`h-full transition-all ${perc >= 100 ? 'bg-rose-500' : perc >= 75 ? 'bg-amber-500' : 'bg-psi-vibrant'}`}
                style={{ width: `${perc}%` }}
              />
            </div>
          </div>
        </td>
        <td className="px-3 py-3" onClick={(event) => event.stopPropagation()}>
          <PsicologoCardAcoes p={p} trabalhando={trabalhando} expanded={expanded}
            onToggleExpanded={alternar} onEditar={onEditar} onAprovar={onAprovar}
            onRecusar={onRecusar} onAtualizarControles={onAtualizarControles} onPriorizar={onPriorizar} />
        </td>
      </tr>

      {expanded && (
        <tr className="bg-psi-soft/10">
          <td colSpan={colunas} className="px-4 pb-5">
            <PsicologoCardDetalhes p={p} trabalhando={trabalhando} onReenviarConvite={onReenviarConvite} />
            {onVinculoAlterado && <VinculosAcademicosPainel p={p} onAlterado={onVinculoAlterado} />}
          </td>
        </tr>
      )}
    </>
  );
}

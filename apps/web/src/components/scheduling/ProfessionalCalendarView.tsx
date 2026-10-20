'use client';

import { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Globe,
  MapPin,
  Phone,
} from 'lucide-react';
import type { AgendamentoResumo } from './UpcomingSessions';
import { CalendarMonthGrid } from './CalendarMonthGrid';
import {
  dataLocal,
  dataPorExtenso,
  formatMonthYear,
  horaLocal,
  monthCells,
  sessoesDaData,
} from './agendaCalendarModel';

interface Props {
  appointments: readonly AgendamentoResumo[];
}

function statusDaSessao(sessao: AgendamentoResumo) {
  if (sessao.status === 'realizado' || sessao.realizadoEm) {
    return { rotulo: 'Realizada', classe: 'bg-emerald-100 text-emerald-700' };
  }
  if (sessao.podeConfirmarRealizacao) {
    return { rotulo: 'Aguardando confirmação', classe: 'bg-amber-100 text-amber-700' };
  }
  if (sessao.status === 'confirmado' || sessao.status === 'confirmada') {
    return { rotulo: 'Confirmada', classe: 'bg-emerald-100 text-emerald-700' };
  }
  return { rotulo: 'Agendada', classe: 'bg-psi-soft text-psi-deep' };
}

function IconeModalidade({ modalidade }: Pick<AgendamentoResumo, 'modalidade'>) {
  if (modalidade === 'presencial') return <MapPin className="h-3.5 w-3.5" />;
  if (modalidade === 'telefone') return <Phone className="h-3.5 w-3.5" />;
  return <Globe className="h-3.5 w-3.5" />;
}

export function ProfessionalCalendarView({ appointments }: Props) {
  const [hoje] = useState(() => dataLocal(Date.now()));
  const [ano, setAno] = useState(() => Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(() => Number(hoje.slice(5, 7)) - 1);
  const [selecionado, setSelecionado] = useState(hoje);

  const celulas = useMemo(() => monthCells(ano, mes), [ano, mes]);
  const sessoesSelecionadas = useMemo(
    () => [...sessoesDaData(appointments, selecionado)].sort((a, b) => a.inicio.localeCompare(b.inicio)),
    [appointments, selecionado]
  );

  const navegarMes = (direcao: -1 | 1) => {
    const data = new Date(Date.UTC(ano, mes + direcao, 1));
    setAno(data.getUTCFullYear());
    setMes(data.getUTCMonth());
  };

  const abrirHoje = () => {
    setAno(Number(hoje.slice(0, 4)));
    setMes(Number(hoje.slice(5, 7)) - 1);
    setSelecionado(hoje);
  };

  return (
    <section id="agenda-calendario" className="overflow-hidden rounded-3xl border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-extrabold text-ink">
            <CalendarIcon className="h-4 w-4 text-psi-vibrant" /> Calendário de marcações
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Selecione um dia para consultar as sessões agendadas.
          </p>
        </div>
        <button type="button" onClick={abrirHoje} className="btn-outline px-3 py-2 text-xs">
          <Clock3 className="h-3.5 w-3.5" /> Hoje
        </button>
      </header>

      <div className="grid divide-y divide-line lg:grid-cols-12 lg:divide-x lg:divide-y-0">
        <div className="space-y-4 p-4 sm:p-6 lg:col-span-6">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => navegarMes(-1)} aria-label="Mês anterior" className="rounded-xl border border-line p-2 text-muted transition hover:bg-canvas hover:text-ink">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <h3 className="text-sm font-black capitalize text-ink">{formatMonthYear(ano, mes)}</h3>
            <button type="button" onClick={() => navegarMes(1)} aria-label="Próximo mês" className="rounded-xl border border-line p-2 text-muted transition hover:bg-canvas hover:text-ink">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <CalendarMonthGrid
            celulas={celulas}
            agendamentos={appointments}
            selecionado={selecionado}
            hoje={hoje}
            onSelecionar={setSelecionado}
          />
        </div>

        <aside className="bg-canvas/40 p-4 sm:p-6 lg:col-span-6">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-psi-vibrant">Agenda do dia</p>
            <h3 className="mt-1 text-base font-black capitalize text-ink">{dataPorExtenso(selecionado)}</h3>
          </div>

          {sessoesSelecionadas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-white/70 px-4 py-10 text-center">
              <CalendarIcon className="mx-auto h-5 w-5 text-muted" />
              <p className="mt-2 text-xs font-bold text-muted">Nenhuma sessão agendada neste dia.</p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {sessoesSelecionadas.map((sessao) => {
                const status = statusDaSessao(sessao);
                return (
                  <li key={sessao.id} className="rounded-2xl border border-line bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-muted">{horaLocal(sessao.inicio)} – {horaLocal(sessao.fim)}</p>
                        <p className="mt-0.5 text-sm font-extrabold text-ink">{sessao.pacienteNome}</p>
                        <p className="mt-1 flex items-center gap-1.5 text-xs capitalize text-muted">
                          <IconeModalidade modalidade={sessao.modalidade} /> {sessao.modalidade}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${status.classe}`}>
                        {status.rotulo}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 rounded-xl border border-psi-soft bg-psi-soft/30 px-3 py-2.5 text-[11px] text-psi-deep">
            Esta visualização é somente para consulta. As alterações continuam disponíveis na lista abaixo.
          </p>
        </aside>
      </div>
    </section>
  );
}

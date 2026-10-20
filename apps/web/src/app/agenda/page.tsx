'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, CircleHelp, Loader2, Search, X } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import { AgendaBlocks, type BloqueioAgenda, type NovoBloqueioAgenda } from '@/components/scheduling/AgendaBlocks';
import { AgendaShareCard } from '@/components/scheduling/AgendaShareCard';
import { AgendaTour, tourJaVisto, type AbaAgenda } from '@/components/scheduling/AgendaTour';
import type { JanelaEditavel } from '@/components/scheduling/AvailabilityEditor';
import { AvailabilitySteps } from '@/components/scheduling/AvailabilitySteps';
import { UpcomingSessions, type AgendamentoResumo } from '@/components/scheduling/UpcomingSessions';
import { ProfessionalCalendarView } from '@/components/scheduling/ProfessionalCalendarView';
import { ManualAppointmentDialog } from '@/components/scheduling/ManualAppointmentDialog';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import { FocoDeNotificacao } from '@/components/layout/FocoDeNotificacao';

interface AgendaOverview {
  professionalName: string;
  agendaToken: string;
  availability: JanelaEditavel[];
  blocks: BloqueioAgenda[];
  appointments: AgendamentoResumo[];
  servicosHabilitados: string[];
  duracoesFixas?: number[];
  permiteDuracaoVariavel?: boolean;
}

function normalizarBuscaPaciente(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export default function AgendaPage() {
  const [dados, setDados] = useState<AgendaOverview>();
  const [pacientes, setPacientes] = useState<readonly PatientDirectoryEntry[]>([]);
  const [buscaPaciente, setBuscaPaciente] = useState('');
  const [agendamentoManualAberto, setAgendamentoManualAberto] = useState(false);
  const [erro, setErro] = useState<string>();
  const [aba, setAba] = useState<AbaAgenda>('sessoes');
  const [tourAberto, setTourAberto] = useState(false);
  const fecharTour = useCallback(() => setTourAberto(false), []);

  const carregar = useCallback(
    () =>
      Promise.all([
        applicationRequest<AgendaOverview>('/agenda'),
        applicationRequest<PatientDirectoryEntry[]>('/patients'),
      ])
        .then(([agenda, listaPacientes]) => {
          setDados(agenda);
          setPacientes(listaPacientes);
          setErro(undefined);
          // Na primeira visita o passo a passo abre sozinho, já com a página montada.
          if (!tourJaVisto()) setTourAberto(true);
        })
        .catch((causa) =>
          setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar a agenda.')
        ),
    []
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const nomesPacientes = useMemo(
    () => Array.from(new Set([
      ...pacientes.map((paciente) => paciente.displayName.trim()),
      ...(dados?.appointments ?? []).map((agendamento) => agendamento.pacienteNome.trim()),
    ].filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [dados?.appointments, pacientes]
  );

  const agendamentosVisiveis = useMemo(() => {
    const termo = normalizarBuscaPaciente(buscaPaciente);
    if (!termo) return dados?.appointments ?? [];
    return (dados?.appointments ?? []).filter((agendamento) =>
      normalizarBuscaPaciente(agendamento.pacienteNome).includes(termo)
    );
  }, [buscaPaciente, dados?.appointments]);

  const salvarGrade = async (availability: JanelaEditavel[]) => {
    const resposta = await applicationRequest<{ availability: JanelaEditavel[] }>(
      '/agenda/disponibilidade',
      { method: 'PUT', body: JSON.stringify({ availability }) }
    );
    setDados((atual) => (atual ? { ...atual, availability: resposta.availability } : atual));
  };

  const adicionarBloqueio = async (input: NovoBloqueioAgenda) => {
    const resposta = await applicationRequest<{ blocks: BloqueioAgenda[] }>('/agenda/bloqueios', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setDados((atual) => (atual ? { ...atual, blocks: resposta.blocks } : atual));
  };

  const removerBloqueio = async (id: string) => {
    const resposta = await applicationRequest<{ blocks: BloqueioAgenda[] }>(
      `/agenda/bloqueios/${encodeURIComponent(id)}`,
      { method: 'DELETE' }
    );
    setDados((atual) => (atual ? { ...atual, blocks: resposta.blocks } : atual));
  };

  const cancelarSessao = async (id: string, motivo: string) => {
    const resposta = await applicationRequest<{ appointments: AgendamentoResumo[] }>(
      `/agenda/agendamentos/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ motivo }) }
    );
    setDados((atual) => (atual ? { ...atual, appointments: resposta.appointments } : atual));
  };

  const confirmarRealizacao = async (id: string) => {
    const resposta = await applicationRequest<{ appointments: AgendamentoResumo[] }>(
      `/agenda/agendamentos/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'complete' }) }
    );
    setDados((atual) => (atual ? { ...atual, appointments: resposta.appointments } : atual));
  };

  const atualizarVencimento = async (id: string, dueAt: string) => {
    const resposta = await applicationRequest<{ appointments: AgendamentoResumo[] }>(
      `/agenda/agendamentos/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'update_charge_due', dueAt }) }
    );
    setDados((atual) => (atual ? { ...atual, appointments: resposta.appointments } : atual));
  };

  const reagendarSessao = async (id: string, startsAt: string, endsAt: string) => {
    const resposta = await applicationRequest<{ appointments: AgendamentoResumo[] }>(
      `/agenda/agendamentos/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'reschedule', startsAt, endsAt }) }
    );
    setDados((atual) => (atual ? { ...atual, appointments: resposta.appointments } : atual));
  };

  const decidirReagendamento = async (requestId: string, decision: 'accept' | 'reject') => {
    const resposta = await applicationRequest<{ appointments: AgendamentoResumo[] }>(
      `/agenda/reagendamentos/${encodeURIComponent(requestId)}`,
      { method: 'PATCH', body: JSON.stringify({ decision }) }
    );
    setDados((atual) => (atual ? { ...atual, appointments: resposta.appointments } : atual));
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="chip-accent text-[11px] mb-1">Agenda &amp; Horários</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-psi-vibrant" />
            Sua agenda de atendimentos
          </h1>
          <p className="max-w-3xl text-xs text-muted">
            Veja suas sessões, ajuste seus horários de atendimento e bloqueie folgas. Use as abas abaixo para trocar de área.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={() => setTourAberto(true)} disabled={!dados} className="btn-outline px-4 py-2.5 text-[13px] font-bold disabled:opacity-50">
            <CircleHelp className="h-4 w-4" /> Ver passo a passo
          </button>
          <button id="agenda-agendar" type="button" onClick={() => setAgendamentoManualAberto(true)} disabled={!dados} className="btn-accent px-5 py-3 text-xs disabled:opacity-50">
            <CalendarPlus className="h-4 w-4" /> Agendar sessão
          </button>
        </div>
      </div>

      {/* Leva até a sessão citada pela notificação do sino; ela mora na aba de sessões. */}
      <FocoDeNotificacao aoFocar={() => setAba('sessoes')} />

      {erro && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{erro}</div>
      )}

      {!dados && !erro && (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-7 h-7 animate-spin text-psi-vibrant" />
        </div>
      )}

      {dados && (
        <>
          <AgendaShareCard token={dados.agendaToken} professionalName={dados.professionalName} />

          <div
            id="agenda-abas"
            role="tablist"
            aria-label="Áreas da agenda"
            className="sticky top-[4.5rem] z-20 flex gap-1.5 overflow-x-auto rounded-[18px] border border-line bg-surface p-1.5 shadow-card sm:top-[5.5rem]"
          >
            {([
              ['sessoes', 'Sessões e confirmações'],
              ['agenda', 'Agenda e disponibilidade'],
            ] as const).map(([valor, rotulo]) => {
              const ativa = aba === valor;
              return (
                <button
                  key={valor}
                  type="button"
                  role="tab"
                  id={`aba-${valor}`}
                  aria-selected={ativa}
                  aria-controls={`painel-${valor}`}
                  onClick={() => setAba(valor)}
                  className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[13px] px-4 py-3 text-[13px] font-extrabold transition ${
                    ativa ? 'bg-psi-darkest text-white' : 'text-muted hover:bg-canvas hover:text-ink'
                  }`}
                >
                  {rotulo}
                  {valor === 'sessoes' && (
                    <span className={`rounded-full px-2 py-px text-[10.5px] tabular-nums ${ativa ? 'bg-psi-vibrant text-white' : 'bg-psi-soft text-psi-deep'}`}>
                      {dados.appointments.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div id="painel-agenda" role="tabpanel" aria-labelledby="aba-agenda" hidden={aba !== 'agenda'} className="space-y-6">
            <AvailabilitySteps
              janelas={dados.availability}
              onSalvar={salvarGrade}
              duracoesFixas={dados.duracoesFixas}
              permiteDuracaoVariavel={dados.permiteDuracaoVariavel ?? false}
              bloqueios={<AgendaBlocks bloqueios={dados.blocks} onAdicionar={adicionarBloqueio} onRemover={removerBloqueio} />}
            />
          </div>

          <div id="painel-sessoes" role="tabpanel" aria-labelledby="aba-sessoes" hidden={aba !== 'sessoes'} className="space-y-6">
            <section className="rounded-2xl border border-psi-soft/60 bg-surface p-4 shadow-card" aria-labelledby="filtro-paciente-agenda">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <label className="block min-w-0 flex-1">
                  <span id="filtro-paciente-agenda" className="mb-1.5 block text-[10px] font-black uppercase tracking-[.16em] text-muted">
                    Buscar sessões por paciente
                  </span>
                  <span className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-psi-vibrant" />
                    <input
                      list="agenda-pacientes"
                      type="search"
                      value={buscaPaciente}
                      onChange={(event) => setBuscaPaciente(event.target.value)}
                      placeholder="Digite o nome da paciente…"
                      className="w-full rounded-xl border border-psi-soft bg-white py-2.5 pl-9 pr-3 text-xs font-medium text-ink placeholder:text-muted focus:border-psi-vibrant focus:outline-none focus:ring-2 focus:ring-psi-vibrant/20"
                      aria-label="Buscar sessões pelo nome do paciente"
                    />
                    <datalist id="agenda-pacientes">
                      {nomesPacientes.map((nome) => <option key={nome} value={nome} />)}
                    </datalist>
                  </span>
                </label>
                {buscaPaciente && (
                  <button
                    type="button"
                    onClick={() => setBuscaPaciente('')}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-bold text-muted transition hover:bg-slate-50 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" /> Mostrar todas
                  </button>
                )}
              </div>
              <p className="mt-2 text-[11px] text-muted" aria-live="polite">
                {buscaPaciente.trim()
                  ? `${agendamentosVisiveis.length} ${agendamentosVisiveis.length === 1 ? 'sessão encontrada' : 'sessões encontradas'} para “${buscaPaciente.trim()}”.`
                  : 'Digite ou selecione um nome para ver somente as sessões dessa paciente.'}
              </p>
            </section>

            <ProfessionalCalendarView appointments={agendamentosVisiveis} />

            <div id="agenda-sessoes">
              <UpcomingSessions
                agendamentos={agendamentosVisiveis}
                filtroPaciente={buscaPaciente}
                onCancelar={cancelarSessao}
                onConfirmarRealizacao={confirmarRealizacao}
                onAtualizarVencimento={atualizarVencimento}
                onReagendar={reagendarSessao}
                onRecarregar={carregar}
                onDecidirReagendamento={decidirReagendamento}
              />
            </div>
          </div>
        </>
      )}

      {tourAberto && dados && <AgendaTour onTrocarAba={setAba} onFechar={fecharTour} />}

      {agendamentoManualAberto && (
        <ManualAppointmentDialog
          patients={pacientes}
          servicosHabilitados={dados?.servicosHabilitados}
          onClose={() => setAgendamentoManualAberto(false)}
          onScheduled={carregar}
        />
      )}
    </div>
  );
}

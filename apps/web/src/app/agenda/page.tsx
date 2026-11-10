'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, CircleHelp, Loader2 } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import { AgendaBlocks, type BloqueioAgenda, type NovoBloqueioAgenda } from '@/components/scheduling/AgendaBlocks';
import { AgendaShareCard } from '@/components/scheduling/AgendaShareCard';
import { AgendaTour, tourJaVisto, type AbaAgenda } from '@/components/scheduling/AgendaTour';
import type { JanelaEditavel } from '@/components/scheduling/AvailabilityEditor';
import { AvailabilitySteps } from '@/components/scheduling/AvailabilitySteps';
import type { AgendamentoResumo } from '@/components/scheduling/UpcomingSessions';
import { AgendaTabs } from '@/components/scheduling/AgendaTabs';
import { AgendaSessionsPanel } from '@/components/scheduling/AgendaSessionsPanel';
import { AvailabilitySummary } from '@/components/scheduling/AvailabilitySummary';
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

  const registrarFalta = async (id: string, cobrar: boolean, expectedVersion?: number) => {
    const resposta = await applicationRequest<{ appointments: AgendamentoResumo[] }>(
      `/agenda/agendamentos/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'no_show', cobrar, expectedVersion }) }
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

  const reagendarSessao = async (id: string, startsAt: string, endsAt: string, expectedVersion?: number) => {
    const resposta = await applicationRequest<{ appointments: AgendamentoResumo[] }>(
      `/agenda/agendamentos/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ action: 'reschedule', startsAt, endsAt, expectedVersion }) }
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

          <AvailabilitySummary
            janelas={dados.availability}
            duracoesFixas={dados.duracoesFixas}
            permiteDuracaoVariavel={dados.permiteDuracaoVariavel}
            onEditar={() => setAba('agenda')}
          />

          <AgendaTabs aba={aba} setAba={setAba} totalSessoes={dados.appointments.length} />

          <div id="painel-agenda" role="tabpanel" aria-labelledby="aba-agenda" hidden={aba !== 'agenda'} className="space-y-6">
            <AvailabilitySteps
              janelas={dados.availability}
              onSalvar={salvarGrade}
              duracoesFixas={dados.duracoesFixas}
              permiteDuracaoVariavel={dados.permiteDuracaoVariavel ?? false}
              bloqueios={<AgendaBlocks bloqueios={dados.blocks} onAdicionar={adicionarBloqueio} onRemover={removerBloqueio} />}
            />
          </div>

          <AgendaSessionsPanel
            ativa={aba === 'sessoes'}
            buscaPaciente={buscaPaciente}
            setBuscaPaciente={setBuscaPaciente}
            nomesPacientes={nomesPacientes}
            agendamentosVisiveis={agendamentosVisiveis}
            cancelarSessao={cancelarSessao}
            confirmarRealizacao={confirmarRealizacao}
            registrarFalta={registrarFalta}
            atualizarVencimento={atualizarVencimento}
            reagendarSessao={reagendarSessao}
            carregar={carregar}
            decidirReagendamento={decidirReagendamento}
          />
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

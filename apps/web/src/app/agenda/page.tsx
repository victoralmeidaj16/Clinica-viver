'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, Loader2 } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import { AgendaBlocks, type BloqueioAgenda, type NovoBloqueioAgenda } from '@/components/scheduling/AgendaBlocks';
import { AgendaShareCard } from '@/components/scheduling/AgendaShareCard';
import { AvailabilityEditor, type JanelaEditavel } from '@/components/scheduling/AvailabilityEditor';
import { UpcomingSessions, type AgendamentoResumo } from '@/components/scheduling/UpcomingSessions';
import { ProfessionalCalendarView } from '@/components/scheduling/ProfessionalCalendarView';

interface AgendaOverview {
  professionalName: string;
  agendaToken: string;
  availability: JanelaEditavel[];
  blocks: BloqueioAgenda[];
  appointments: AgendamentoResumo[];
}

export default function AgendaPage() {
  const [dados, setDados] = useState<AgendaOverview>();
  const [erro, setErro] = useState<string>();

  const carregar = useCallback(
    () =>
      applicationRequest<AgendaOverview>('/agenda')
        .then((resultado) => {
          setDados(resultado);
          setErro(undefined);
        })
        .catch((causa) =>
          setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar a agenda.')
        ),
    []
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      <div>
        <span className="chip-accent text-[11px] mb-1">Agenda &amp; Horários</span>
        <h1 className="text-2xl font-black text-ink flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-psi-vibrant" />
          Sua agenda de atendimentos
        </h1>
        <p className="text-xs text-muted">
          Seus turnos cadastrados habilitam automaticamente a grade inicial de segunda a sexta. Você ainda pode ajustar horários, bloquear períodos e compartilhar seu link exclusivo.
        </p>
      </div>

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

          {/* Calendário Interativo do Psicólogo */}
          <ProfessionalCalendarView
            availability={dados.availability}
            blocks={dados.blocks}
            appointments={dados.appointments}
            onAdicionarBloqueio={adicionarBloqueio}
            onRemoverBloqueio={removerBloqueio}
          />

          <AvailabilityEditor janelas={dados.availability} onSalvar={salvarGrade} />
          <AgendaBlocks bloqueios={dados.blocks} onAdicionar={adicionarBloqueio} onRemover={removerBloqueio} />
          <UpcomingSessions agendamentos={dados.appointments} onCancelar={cancelarSessao} />
        </>
      )}
    </div>
  );
}

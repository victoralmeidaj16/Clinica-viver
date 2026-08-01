'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock3, Link2, LoaderCircle, Plus, RotateCw, Video, X, CreditCard } from 'lucide-react';
import type { Appointment } from '@thats-life/core';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import { patientNames } from './demoScheduling';
import { AppointmentBookingModal } from './AppointmentBookingModal';

const day = (value: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(value));
const time = (value: string) => new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }).format(new Date(value));
type MutationResult = { appointment: Appointment; idempotentReplay: boolean };

export function AgendaWorkspace() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [showNew, setShowNew] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);

  const load = async () => {
    try {
      setError(undefined);
      setLoading(true);
      setAppointments(await applicationRequest<Appointment[]>('/appointments'));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Falha ao carregar agenda.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    applicationRequest<Appointment[]>('/appointments')
      .then((items) => { if (mounted) setAppointments(items); })
      .catch((caught: unknown) => { if (mounted) setError(caught instanceof Error ? caught.message : 'Falha ao carregar agenda.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const active = appointments.filter((item) => item.status !== 'cancelled').sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  const change = async (item: Appointment, body: Record<string, unknown>) => {
    try {
      setBusyId(item.id);
      setError(undefined);
      const result = await applicationRequest<MutationResult>(`/appointments/${item.id}`, {
        method: 'PATCH',
        headers: commandHeaders(),
        body: JSON.stringify({ ...body, occurredAt: new Date().toISOString() })
      });
      setAppointments((items) => items.map((current) => current.id === item.id ? result.appointment : current));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível alterar o agendamento.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 pb-10">
      <header className="overflow-hidden rounded-[28px] bg-[#213a35] p-8 text-white">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.24em] text-emerald-200">Agenda & Pagamentos Telepresenciais</p>
            <h1 className="mt-3 font-serif text-4xl font-bold">Agendamento em 1-Clique</h1>
            <p className="mt-2 max-w-xl text-sm text-emerald-50/70">
              Escolha horários, faça pagamento via PIX/Cartão e receba o link da sala Zoom imediatamente.
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsBookingModalOpen(true)}
              className="rounded-xl bg-[#f1c96b] px-5 py-3 text-sm font-bold text-[#213a35] hover:bg-[#e2bb5d] transition-all flex items-center space-x-2"
            >
              <CreditCard className="w-4 h-4" />
              <span>Agendar & Pagar Consulta</span>
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <span>{error}</span>
          <button onClick={() => void load()} className="font-bold underline">Tentar novamente</button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_310px]">
        <section className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl font-bold text-ink">Próximos atendimentos</h2>
              <p className="text-xs text-muted">{loading ? 'Sincronizando…' : `${active.length} horários ativos`}</p>
            </div>
            {loading ? <LoaderCircle className="h-6 w-6 animate-spin text-primary" /> : <CalendarDays className="h-6 w-6 text-primary" />}
          </div>

          <div className="space-y-3">
            {active.map((item) => (
              <article key={item.id} className="grid gap-4 rounded-2xl border border-line p-4 transition hover:border-primary/30 hover:bg-soft/30 md:grid-cols-[110px_1fr_auto] md:items-center">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-wider text-primary">{day(item.startsAt)}</p>
                  <p className="mt-1 font-serif text-2xl font-bold text-ink">{time(item.startsAt)}</p>
                </div>
                <div>
                  <p className="font-bold text-ink">{patientNames[item.patientId] ?? item.patientId}</p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-muted">
                    {item.mode === 'video' ? <Video className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                    {item.mode === 'video' ? 'Videochamada Zoom' : item.mode === 'phone' ? 'Telefone' : 'Presencial'} · 50 min
                  </p>
                  <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[10px] font-bold ${item.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.status === 'confirmed' ? 'Confirmado & Pago' : 'A confirmar'}
                  </span>
                </div>
                <div className="flex gap-1 opacity-100">
                  {busyId === item.id ? (
                    <LoaderCircle className="m-2 h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <>
                      {item.status === 'scheduled' && (
                        <button title="Confirmar" onClick={() => void change(item, { action: 'confirm' })} className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50">
                          <Check className="h-4 w-4" />
                        </button>
                      )}
                      <button title="Reagendar" onClick={() => {
                        const start = new Date(item.startsAt);
                        const end = new Date(item.endsAt);
                        start.setUTCDate(start.getUTCDate() + 1);
                        end.setUTCDate(end.getUTCDate() + 1);
                        void change(item, { action: 'reschedule', startsAt: start.toISOString(), endsAt: end.toISOString() });
                      }} className="rounded-lg p-2 text-primary hover:bg-soft">
                        <RotateCw className="h-4 w-4" />
                      </button>
                      <button title="Cancelar" onClick={() => void change(item, { action: 'cancel', reasonCode: 'DEMO_CANCELLED' })} className="rounded-lg p-2 text-rose-600 hover:bg-rose-50">
                        <X className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-3xl border border-line bg-[#f0e9dc] p-5">
            <Link2 className="h-5 w-5 text-primary" />
            <h3 className="mt-5 font-serif text-xl font-bold text-ink">Google Agenda</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted">A porta OAuth já está pronta no core. A conexão sincroniza agendamentos em tempo real.</p>
          </div>
          <div className="rounded-3xl bg-[#2f2550] p-5 text-white">
            <p className="text-[10px] font-black uppercase tracking-widest text-violet-200">Automação Financeira</p>
            <p className="mt-4 font-serif text-3xl font-bold">R$ 750,00</p>
            <p className="text-xs text-white/60">em recibos e PIX processados esta semana</p>
          </div>
        </aside>
      </div>

      <AppointmentBookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
      />
    </div>
  );
}

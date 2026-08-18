'use client';

import { use, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, CalendarDays, Clock, FileText, Loader2, User, Brain } from 'lucide-react';
import { PublicBookingCalendar } from '@/components/scheduling/PublicBookingCalendar';

interface Props {
  params: Promise<{ token: string }>;
}
interface Horario {
  inicio: string;
  hora: string;
  modalidade: string;
}
interface DiaComHorarios {
  dia: string;
  horarios: Horario[];
}
interface Agenda {
  pacienteNome: string;
  professionalName: string;
  dias: DiaComHorarios[];
}
interface Confirmado {
  inicio: string;
  fim: string;
  modalidade: string;
}

function rotuloDia(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    timeZone: 'UTC',
  });
}

export default function AgendarPage({ params }: Props) {
  const { token } = use(params);
  const [professionalName, setProfessionalName] = useState<string>();
  const [cpf, setCpf] = useState('');
  const [agenda, setAgenda] = useState<Agenda>();
  const [diaSelecionado, setDiaSelecionado] = useState<string>();
  const [confirmado, setConfirmado] = useState<Confirmado>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string>();
  const passoHorario = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/agenda/perfil/${encodeURIComponent(token)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Link de agendamento inválido.');
        setProfessionalName(body.professionalName);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'Link inválido.'))
      .finally(() => setLoading(false));
  }, [token]);

  const identificar = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(undefined);
    try {
      const response = await fetch('/api/agenda/horarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os horários.');
      setAgenda(body);
      setDiaSelecionado(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os horários.');
    } finally {
      setLoading(false);
    }
  };

  const selecionarDia = (dia: string) => {
    setDiaSelecionado(dia);
    window.requestAnimationFrame(() =>
      passoHorario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  const recarregarHorarios = async () => {
    const response = await fetch('/api/agenda/horarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, cpf }),
    });
    if (response.ok) setAgenda(await response.json());
  };

  const agendar = async (horario: Horario) => {
    setSalvando(horario.inicio);
    setError(undefined);
    try {
      const response = await fetch('/api/agenda/agendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf, inicio: horario.inicio }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) await recarregarHorarios();
        throw new Error(body.error || 'Não foi possível agendar.');
      }
      setConfirmado(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível agendar.');
    } finally {
      setSalvando(undefined);
    }
  };

  if (loading && !professionalName) {
    return (
      <div className="py-20 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-psi-vibrant" />
      </div>
    );
  }

  if (!professionalName) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">
        {error || 'Link de agendamento inválido.'}
      </div>
    );
  }

  const horariosDoDia = agenda?.dias.find((item) => item.dia === diaSelecionado)?.horarios ?? [];

  return (
    <div className="space-y-6 max-w-xl mx-auto py-6 px-4">
      {/* Banner Principal com Branding Viver Mais Psi */}
      <section className="card-contrast rounded-2xl p-6 flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-psi-vibrant text-white flex items-center justify-center shrink-0 shadow-lg shadow-psi-vibrant/30">
          <Brain className="w-7 h-7" />
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-widest text-psi-soft font-black px-2 py-0.5 rounded-md bg-psi-vibrant/20 border border-psi-vibrant/30">
            Agenda Online
          </span>
          <h1 className="text-xl text-white font-black mt-1">{professionalName}</h1>
          <p className="text-xs text-psi-soft/80">Viver Mais Psicologia — Atendimento &amp; Saúde</p>
        </div>
      </section>

      {confirmado ? (
        <section className="card border-psi-vibrant/40 text-center space-y-4">
          <div className="chip-accent text-xs">
            <CalendarCheck className="w-4 h-4" /> Sessão Agendada com Sucesso
          </div>
          <p className="text-2xl text-ink font-black capitalize">{rotuloDia(confirmado.inicio.slice(0, 10))}</p>
          <p className="text-lg text-psi-deep font-bold">
            {new Date(confirmado.inicio).toLocaleTimeString('pt-BR', {
              hour: '2-digit',
              minute: '2-digit',
              timeZone: 'America/Sao_Paulo',
            })}
            {' · '}
            {confirmado.modalidade === 'online' ? 'Atendimento Online' : 'Atendimento Presencial'}
          </p>
          <p className="text-xs text-muted">
            {professionalName} já recebeu a confirmação do seu horário.
          </p>
        </section>
      ) : !agenda ? (
        <form
          onSubmit={identificar}
          className="card space-y-5"
        >
          <div>
            <h2 className="font-black text-ink flex items-center gap-2">
              <CalendarDays className="w-5 h-5 text-psi-vibrant" /> Marcar Sua Consulta
            </h2>
            <p className="text-xs text-muted mt-1">
              Informe seu CPF para validar seu cadastro e visualizar os horários livres.
            </p>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          <label className="text-xs font-bold text-ink block">
            CPF do Paciente
            <div className="relative mt-1">
              <FileText className="absolute left-3.5 top-3.5 w-4 h-4 text-muted" />
              <input
                required
                inputMode="numeric"
                autoComplete="off"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="input py-3 pl-11 text-xs font-bold"
              />
            </div>
          </label>

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-psi-vibrant hover:bg-psi-vibrant/90 p-4 text-xs font-black text-white flex justify-center items-center gap-2 shadow-lg shadow-psi-vibrant/30 disabled:opacity-50 transition-all"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Continuar <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        <>
          <section className="card space-y-5">
            <div>
              <p className="text-xs text-psi-vibrant font-bold">Olá, {agenda.pacienteNome}</p>
              <h2 className="font-black text-ink flex items-center gap-2 mt-1">
                <CalendarDays className="w-5 h-5 text-psi-vibrant" /> Escolha o Dia
              </h2>
            </div>
            {agenda.dias.length === 0 ? (
              <p className="rounded-2xl border border-line bg-soft/50 p-4 text-xs text-muted">
                Não há horários livres nas próximas semanas. Fale com {professionalName} pelo WhatsApp.
              </p>
            ) : (
              <PublicBookingCalendar
                diasDisponiveis={agenda.dias.map((item) => item.dia)}
                diaSelecionado={diaSelecionado}
                onSelecionar={selecionarDia}
              />
            )}
          </section>

          {diaSelecionado && (
            <section
              ref={passoHorario}
              className="card space-y-5 scroll-mt-6"
            >
              <h2 className="font-black text-ink flex items-center gap-2">
                <Clock className="w-5 h-5 text-psi-vibrant" /> Escolha o Horário
              </h2>
              <label className="text-xs font-bold text-ink block">
                Dia Selecionado
                <input
                  readOnly
                  value={rotuloDia(diaSelecionado)}
                  className="mt-1 w-full rounded-2xl border border-psi-vibrant/30 bg-psi-soft/60 py-2.5 px-4 text-psi-darkest font-bold capitalize text-xs"
                />
              </label>

              {error && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {horariosDoDia.map((horario) => (
                  <button
                    key={horario.inicio}
                    type="button"
                    disabled={Boolean(salvando)}
                    onClick={() => void agendar(horario)}
                    className="rounded-2xl border border-psi-vibrant/30 bg-surface py-3 text-xs font-black text-psi-deep hover:bg-psi-vibrant hover:text-white hover:border-psi-vibrant transition-all disabled:opacity-40"
                  >
                    {salvando === horario.inicio ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : horario.hora}
                  </button>
                ))}
              </div>

              {horariosDoDia.length === 0 && (
                <p className="text-xs text-muted">
                  Os horários deste dia acabaram de ser ocupados. Escolha outro dia acima.
                </p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

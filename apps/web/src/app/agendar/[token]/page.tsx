'use client';

import { use, useEffect, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck, CalendarDays, Clock, FileText, Loader2, User } from 'lucide-react';
import { PublicBookingCalendar } from '@/components/scheduling/PublicBookingCalendar';

interface Props { params: Promise<{ token: string }> }
interface Horario { inicio: string; hora: string; modalidade: string }
interface DiaComHorarios { dia: string; horarios: Horario[] }
interface Agenda { pacienteNome: string; professionalName: string; dias: DiaComHorarios[] }
interface Confirmado { inicio: string; fim: string; modalidade: string }

function rotuloDia(dia: string): string {
  return new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC',
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
    setLoading(true); setError(undefined);
    try {
      const response = await fetch('/api/agenda/horarios', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os horários.');
      setAgenda(body); setDiaSelecionado(undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os horários.');
    } finally { setLoading(false); }
  };

  // A rolagem é o que emenda os dois passos: o calendário ocupa a tela inteira
  // no celular, e sem ela o paciente escolhe o dia e não vê que a lista de
  // horários apareceu logo abaixo.
  const selecionarDia = (dia: string) => {
    setDiaSelecionado(dia);
    window.requestAnimationFrame(() =>
      passoHorario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  };

  /** Recarrega a grade sem mexer no estado de erro nem no passo da tela. */
  const recarregarHorarios = async () => {
    const response = await fetch('/api/agenda/horarios', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, cpf }),
    });
    if (response.ok) setAgenda(await response.json());
  };

  const agendar = async (horario: Horario) => {
    setSalvando(horario.inicio); setError(undefined);
    try {
      const response = await fetch('/api/agenda/agendar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, cpf, inicio: horario.inicio }),
      });
      const body = await response.json();
      if (!response.ok) {
        // Conflito devolve o paciente à lista já sem o horário tomado, em vez
        // de deixá-lo tentando de novo no botão que acabou de falhar.
        if (response.status === 409) await recarregarHorarios();
        throw new Error(body.error || 'Não foi possível agendar.');
      }
      setConfirmado(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível agendar.');
    } finally { setSalvando(undefined); }
  };

  if (loading && !professionalName) {
    return <div className="py-20 flex justify-center"><Loader2 className="w-7 h-7 animate-spin text-emerald-400" /></div>;
  }
  if (!professionalName) {
    return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 p-6 text-sm text-rose-200">{error || 'Link de agendamento inválido.'}</div>;
  }

  const horariosDoDia = agenda?.dias.find((item) => item.dia === diaSelecionado)?.horarios ?? [];

  return <div className="space-y-6">
    <section className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 flex items-center gap-4">
      <div className="w-16 h-16 rounded-2xl bg-slate-700 flex items-center justify-center"><User className="w-8 h-8 text-emerald-400" /></div>
      <div>
        <p className="text-[10px] uppercase tracking-widest text-emerald-400 font-black">Agenda de</p>
        <h1 className="text-xl text-white font-black">{professionalName}</h1>
        <p className="text-xs text-slate-400">Clínica Viver Mais</p>
      </div>
    </section>

    {confirmado ? <section className="bg-slate-800/80 border border-emerald-500/30 rounded-3xl p-6 text-center space-y-4">
      <div className="inline-flex gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400">
        <CalendarCheck className="w-4 h-4" /> Sessão agendada
      </div>
      <p className="text-2xl text-white font-black capitalize">{rotuloDia(confirmado.inicio.slice(0, 10))}</p>
      <p className="text-lg text-emerald-300 font-bold">
        {new Date(confirmado.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}
        {' · '}{confirmado.modalidade === 'online' ? 'Atendimento online' : 'Atendimento presencial'}
      </p>
      <p className="text-xs text-slate-400">{professionalName} já foi avisado. Guarde este horário.</p>
    </section> : !agenda ? <form onSubmit={identificar} className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 space-y-5">
      <div>
        <h2 className="font-black text-white flex gap-2"><CalendarDays className="w-5 h-5 text-emerald-400" /> Marcar sua sessão</h2>
        <p className="text-xs text-slate-400 mt-1">Identifique seu cadastro pelo CPF para ver os horários disponíveis.</p>
      </div>
      {error && <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300">{error}</div>}
      <label className="text-xs font-bold text-slate-300 block">CPF do paciente
        <div className="relative mt-1">
          <FileText className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
          <input required inputMode="numeric" autoComplete="off" value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" className="w-full rounded-2xl bg-slate-900 border border-slate-700 py-2.5 pl-10 pr-4 text-white" />
        </div>
      </label>
      <button disabled={loading} className="w-full rounded-2xl bg-emerald-500 p-4 text-sm font-black text-slate-950 flex justify-center gap-2 disabled:opacity-50">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Continuar <ArrowRight className="w-5 h-5" /></>}
      </button>
    </form> : <>
      <section className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 space-y-5">
        <div>
          <p className="text-xs text-emerald-400 font-bold">Olá, {agenda.pacienteNome}</p>
          <h2 className="font-black text-white flex gap-2 mt-1"><CalendarDays className="w-5 h-5 text-emerald-400" /> Escolha o dia</h2>
        </div>
        {agenda.dias.length === 0
          ? <p className="rounded-2xl bg-slate-900 border border-slate-700 p-4 text-xs text-slate-400">Não há horários livres nas próximas semanas. Fale com {professionalName} pelo WhatsApp.</p>
          : <PublicBookingCalendar diasDisponiveis={agenda.dias.map((item) => item.dia)} diaSelecionado={diaSelecionado} onSelecionar={selecionarDia} />}
      </section>

      {diaSelecionado && <section ref={passoHorario} className="bg-slate-800/60 border border-slate-700 rounded-3xl p-6 space-y-5 scroll-mt-6">
        <h2 className="font-black text-white flex gap-2"><Clock className="w-5 h-5 text-emerald-400" /> Escolha o horário</h2>
        <label className="text-xs font-bold text-slate-300 block">Dia selecionado
          <input readOnly value={rotuloDia(diaSelecionado)} className="mt-1 w-full rounded-2xl bg-slate-900 border border-emerald-500/30 py-2.5 px-4 text-emerald-300 font-bold capitalize" />
        </label>
        {error && <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300">{error}</div>}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {horariosDoDia.map((horario) => <button key={horario.inicio} type="button" disabled={Boolean(salvando)} onClick={() => void agendar(horario)} className="rounded-2xl border border-emerald-500/30 bg-slate-900 py-3 text-sm font-black text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition-colors disabled:opacity-40">
            {salvando === horario.inicio ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : horario.hora}
          </button>)}
        </div>
        {horariosDoDia.length === 0 && <p className="text-xs text-slate-400">Os horários deste dia acabaram de ser ocupados. Escolha outro dia acima.</p>}
      </section>}
    </>}
  </div>;
}

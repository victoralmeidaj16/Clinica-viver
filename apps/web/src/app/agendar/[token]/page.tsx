'use client';

import { use, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Brain,
  CalendarCheck,
  CalendarDays,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  Phone,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { PublicBookingCalendar } from '@/components/scheduling/PublicBookingCalendar';
import { maskCpf, validCpf } from '@/lib/cpf';

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
interface AgendamentoAtual {
  id: string;
  inicio: string;
  fim: string;
  modalidade: string;
  status: string;
  linkPagamento?: string;
  podeReagendar: boolean;
  horasAteInicio: number;
}
interface Agenda {
  pacienteNome: string;
  professionalName: string;
  dias: DiaComHorarios[];
  agendamentoAtual?: AgendamentoAtual | null;
}
interface Confirmado {
  inicio: string;
  fim: string;
  modalidade: string;
  linkPagamento: string;
  reagendado?: boolean;
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
  const [modoReagendar, setModoReagendar] = useState(false);
  const passoHorario = useRef<HTMLDivElement>(null);
  const passoCalendario = useRef<HTMLDivElement>(null);

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
    if (!validCpf(cpf)) {
      setError('Informe um CPF válido, com 11 dígitos.');
      return;
    }
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
      setModoReagendar(false);
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

  const iniciarReagendamento = () => {
    setModoReagendar(true);
    setDiaSelecionado(undefined);
    window.requestAnimationFrame(() =>
      passoCalendario.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      const isReagendando = Boolean(modoReagendar && agenda?.agendamentoAtual);
      const url = isReagendando ? '/api/agenda/reagendar' : '/api/agenda/agendar';
      const payload = isReagendando
        ? { token, cpf, appointmentId: agenda?.agendamentoAtual?.id, inicio: horario.inicio }
        : { token, cpf, inicio: horario.inicio };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) await recarregarHorarios();
        throw new Error(body.error || 'Não foi possível agendar.');
      }
      setConfirmado({ ...body, reagendado: isReagendando });
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
            <CalendarCheck className="w-4 h-4" /> {confirmado.reagendado ? 'Sessão Reagendada com Sucesso' : 'Sessão Agendada com Sucesso'}
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
          <a
            href={confirmado.linkPagamento}
            className="btn-accent mx-auto w-full justify-center py-3 text-sm"
          >
            <CreditCard className="h-4 w-4" /> Pagamento desta sessão
          </a>
          <p className="text-[11px] text-muted">
            Este link pertence somente ao horário acima e poderá ser usado novamente para consultar a mesma cobrança.
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
                maxLength={14}
                onChange={(e) => {
                  setCpf(maskCpf(e.target.value));
                  if (error) setError(undefined);
                }}
                placeholder="000.000.000-00"
                className={`input py-3 pl-11 text-xs font-bold transition-colors ${
                  cpf.length === 14 && !validCpf(cpf)
                    ? 'border-rose-400 bg-rose-50/40 text-rose-900 focus:border-rose-600'
                    : cpf.length === 14 && validCpf(cpf)
                      ? 'border-emerald-400 bg-emerald-50/30 text-ink focus:border-emerald-600'
                      : ''
                }`}
              />
            </div>
            {cpf.length === 14 && !validCpf(cpf) && (
              <span className="mt-1.5 block text-[11px] font-semibold text-rose-600">
                CPF inválido. Confira os números digitados.
              </span>
            )}
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
              <div className="mb-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Paciente identificado</p>
                  <p className="text-sm font-black text-emerald-950">{agenda.pacienteNome}</p>
                </div>
              </div>

              {/* Card do Agendamento Futuro Existente */}
              {agenda.agendamentoAtual && (
                <div className="mb-5 rounded-2xl border border-purple-200 bg-purple-50/60 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                        Sua Próxima Sessão Agendada
                      </span>
                      <p className="text-base font-extrabold text-ink capitalize">
                        {rotuloDia(agenda.agendamentoAtual.inicio.slice(0, 10))}
                      </p>
                      <p className="text-xs font-semibold text-purple-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-purple-600" />
                        {new Date(agenda.agendamentoAtual.inicio).toLocaleTimeString('pt-BR', {
                          hour: '2-digit',
                          minute: '2-digit',
                          timeZone: 'America/Sao_Paulo',
                        })}
                        {' · '}
                        {agenda.agendamentoAtual.modalidade === 'online' ? 'Atendimento Online' : 'Atendimento Presencial'}
                      </p>
                    </div>

                    {agenda.agendamentoAtual.podeReagendar ? (
                      <button
                        type="button"
                        onClick={iniciarReagendamento}
                        className="rounded-xl border border-purple-300 bg-white px-3.5 py-2 text-xs font-black text-purple-800 hover:bg-purple-100/70 shadow-sm flex items-center gap-1.5 transition shrink-0"
                      >
                        <RefreshCw className="w-3.5 h-3.5 text-purple-600" />
                        Reagendar
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-200">
                        &lt; 2h para a sessão
                      </span>
                    )}
                  </div>

                  {!agenda.agendamentoAtual.podeReagendar && (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-[11px] text-amber-900 font-medium flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <span>
                        Falta menos de 2 horas para sua sessão. Para reagendar ou cancelar agora, por favor entre em contato direto com <strong>{professionalName}</strong> via WhatsApp.
                      </span>
                    </div>
                  )}

                  {agenda.agendamentoAtual.linkPagamento && (
                    <div className="pt-2 border-t border-purple-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-muted">Pagamento desta consulta:</span>
                      <a
                        href={agenda.agendamentoAtual.linkPagamento}
                        className="text-xs font-bold text-psi-deep hover:underline flex items-center gap-1"
                      >
                        <CreditCard className="w-3 h-3" /> Ver fatura / pagar
                      </a>
                    </div>
                  )}
                </div>
              )}

              <div ref={passoCalendario} className="scroll-mt-6">
                <h2 className="font-black text-ink flex items-center gap-2 mt-1">
                  <CalendarDays className="w-5 h-5 text-psi-vibrant" /> {modoReagendar ? 'Escolha a Nova Data' : 'Escolha o Dia'}
                </h2>
                {modoReagendar && (
                  <p className="text-xs text-purple-700 font-semibold mt-1">
                    Selecione o novo dia e horário para substituir seu agendamento atual.
                  </p>
                )}
              </div>
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
                <Clock className="w-5 h-5 text-psi-vibrant" /> {modoReagendar ? 'Escolha o Novo Horário' : 'Escolha o Horário'}
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
                    {salvando === horario.inicio ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (
                      modoReagendar ? `Mudar para ${horario.hora}` : horario.hora
                    )}
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

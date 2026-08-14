'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PatientDirectoryEntry } from '@/server/application/patientDirectory';
import {
  Phone,
  Calendar,
  Clock,
  ArrowRight,
  Zap,
  CheckCircle2,
  PauseCircle,
  Search,
  Users,
  Send,
  CalendarPlus,
  Loader2,
  X,
  FileText,
} from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';

interface PatientListProps {
  patients: readonly PatientDirectoryEntry[];
  agendaToken?: string;
  onOpenNewPatientModal: () => void;
  onPatientUpdated?: () => void;
}

const STATUS_LABEL: Record<PatientDirectoryEntry['status'], string> = {
  active: 'Ativo',
  paused: 'Em Pausa',
  discharged: 'Alta',
};

function formatNextAppointment(iso?: string): string {
  if (!iso) return 'A agendar';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function PatientList({
  patients,
  agendaToken,
  onOpenNewPatientModal,
  onPatientUpdated,
}: PatientListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [patientForSchedule, setPatientForSchedule] = useState<PatientDirectoryEntry | null>(null);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('14:00');
  const [scheduleModality, setScheduleModality] = useState<'online' | 'presencial'>('online');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string>();
  const [scheduleSuccess, setScheduleSuccess] = useState<string>();

  // KPIs Rápidos
  const pacientesAtivosCount = patients.filter((p) => p.status === 'active').length;
  const sessoesNoMesCount = patients.reduce((acc, p) => acc + (p.completedSessions || 0), 0);

  // Filtro de Pesquisa (Nome, Telefone ou Email)
  const filteredPatients = patients.filter((patient) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    const cleanQuery = query.replace(/\D/g, '');
    const cleanPhone = (patient.phone || '').replace(/\D/g, '');

    return (
      patient.displayName.toLowerCase().includes(query) ||
      (patient.email && patient.email.toLowerCase().includes(query)) ||
      (cleanQuery.length > 0 && cleanPhone.includes(cleanQuery))
    );
  });

  const abrirWhatsAppAgenda = (patient: PatientDirectoryEntry) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://clinica-viver-web.vercel.app';
    const linkAgenda = agendaToken ? `${origin}/agendar/${agendaToken}` : `${origin}/agenda`;

    const texto = encodeURIComponent(
      `Olá, ${patient.displayName}! Segue o link para você escolher o melhor dia e horário para a nossa próxima sessão na Clínica Viver Mais:\n\n${linkAgenda}`
    );

    const telefoneLimpo = (patient.phone || '').replace(/\D/g, '');
    const urlWhatsApp = telefoneLimpo
      ? `https://wa.me/55${telefoneLimpo}?text=${texto}`
      : `https://wa.me/?text=${texto}`;

    window.open(urlWhatsApp, '_blank', 'noopener,noreferrer');
  };

  const handleSalvarAgendamentoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientForSchedule || !scheduleDate || !scheduleTime) return;

    setSavingSchedule(true);
    setScheduleError(undefined);
    setScheduleSuccess(undefined);

    try {
      const startsAt = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
      const endsAt = new Date(Date.parse(startsAt) + 50 * 60_000).toISOString();

      await applicationRequest('/appointments', {
        method: 'POST',
        body: JSON.stringify({
          id: `app-manual-${crypto.randomUUID()}`,
          patientId: patientForSchedule.id,
          startsAt,
          endsAt,
          mode: scheduleModality === 'online' ? 'video' : 'in_person',
        }),
      });

      setScheduleSuccess(`Sessão agendada com sucesso para ${patientForSchedule.displayName}!`);
      setTimeout(() => {
        setPatientForSchedule(null);
        setScheduleSuccess(undefined);
        if (onPatientUpdated) onPatientUpdated();
      }, 1500);
    } catch (err: unknown) {
      setScheduleError(err instanceof Error ? err.message : 'Não foi possível agendar o horário.');
    } finally {
      setSavingSchedule(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner de Gestão */}
      <div className="card bg-gradient-to-r from-primary via-primary-dark to-purple-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-6 shadow-xl">
        <div className="space-y-1">
          <span className="chip bg-white/10 text-white border-white/20 text-xs">
            Gestão de Atendimentos
          </span>
          <h2 className="text-xl font-black">Prontuários &amp; Lista de Pacientes</h2>
          <p className="text-xs text-white/80 max-w-xl">
            Acompanhe o histórico de sessões e o plano terapêutico de cada paciente.
          </p>
        </div>

        <button onClick={onOpenNewPatientModal} className="btn-accent py-2.5 px-4 text-xs shrink-0 shadow-md">
          + Cadastrar Novo Paciente
        </button>
      </div>

      {/* Painel de Indicadores no Topo (KPIs Rápidos) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pacientes Ativos</span>
            <p className="text-3xl font-black text-slate-900">{pacientesAtivosCount}</p>
            <p className="text-xs text-slate-500">Em acompanhamento frequente</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sessões Realizadas</span>
            <p className="text-3xl font-black text-psi-vibrant">{sessoesNoMesCount}</p>
            <p className="text-xs text-slate-500">Atendimentos concluídos</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center border border-psi-vibrant/20 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Barra de Busca e Filtros Inteligentes */}
      <div className="bg-white border border-slate-200 rounded-3xl p-4 shadow-sm flex items-center gap-3">
        <Search className="w-5 h-5 text-slate-400 shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar paciente por nome, telefone ou CPF..."
          className="w-full text-xs font-bold text-slate-800 placeholder-slate-400 bg-transparent outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {patients.length === 0 && (
        <div className="card text-center py-10 space-y-2">
          <p className="text-sm font-bold text-ink">Nenhum paciente cadastrado</p>
          <p className="text-xs text-muted">
            Cadastre o primeiro paciente para que ele apareça na agenda e no cockpit.
          </p>
        </div>
      )}

      {patients.length > 0 && filteredPatients.length === 0 && (
        <div className="card text-center py-10 space-y-2">
          <p className="text-sm font-bold text-ink">Nenhum paciente encontrado</p>
          <p className="text-xs text-muted">
            Não encontramos resultados para &quot;{searchQuery}&quot;. Tente outro nome ou número.
          </p>
        </div>
      )}

      {/* Grid de Pacientes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPatients.map((patient) => (
          <div key={patient.id} className="card card-hover space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary font-bold flex items-center justify-center text-base border border-primary/20">
                    {patient.displayName.charAt(0)}
                  </div>
                  <div
                    onClick={() => router.push(`/linha-do-tempo?patientId=${patient.id}`)}
                    className="cursor-pointer group/patient"
                  >
                    <h3 className="font-extrabold text-sm text-ink group-hover/patient:text-psi-vibrant transition-colors">{patient.displayName}</h3>
                    {patient.phone && (
                      <p className="text-xs text-muted flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        {patient.phone}
                      </p>
                    )}
                  </div>
                </div>

                <span
                  className={`chip text-[11px] ${
                    patient.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {patient.status === 'active' ? (
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <PauseCircle className="w-3 h-3 text-amber-600" />
                  )}
                  {STATUS_LABEL[patient.status]}
                </span>
              </div>

              {/* Metadados da Agenda */}
              <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-line">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  <span>Próxima: {formatNextAppointment(patient.nextAppointmentAt)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-accent" />
                  <span>{patient.completedSessions} Sessões</span>
                </div>
              </div>
            </div>

            {/* Ações Rápidas (3 Botões) */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => router.push(`/linha-do-tempo?patientId=${patient.id}`)}
                className="w-full btn-outline text-xs py-2.5 justify-center gap-2 group"
              >
                <FileText className="w-3.5 h-3.5 text-psi-vibrant group-hover:scale-110 transition-transform" />
                <span>Ver Prontuário do Paciente</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setPatientForSchedule(patient);
                    setScheduleDate(new Date().toISOString().slice(0, 10));
                    setScheduleTime('14:00');
                    setScheduleError(undefined);
                    setScheduleSuccess(undefined);
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 p-2 text-[11px] font-bold text-slate-700 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <CalendarPlus className="w-3.5 h-3.5 text-psi-vibrant" />
                  <span>Agendar Horário</span>
                </button>

                <button
                  onClick={() => abrirWhatsAppAgenda(patient)}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 p-2 text-[11px] font-bold text-emerald-800 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enviar Agenda</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Agendamento Manual */}
      {patientForSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <CalendarPlus className="w-5 h-5 text-psi-vibrant" />
                <h3 className="font-extrabold text-sm text-slate-900">Agendar Sessão Manualmente</h3>
              </div>
              <button
                onClick={() => setPatientForSchedule(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Paciente</span>
              <p className="font-black text-slate-800">{patientForSchedule.displayName}</p>
            </div>

            {scheduleError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                {scheduleError}
              </div>
            )}

            {scheduleSuccess && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {scheduleSuccess}
              </div>
            )}

            <form onSubmit={handleSalvarAgendamentoManual} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Data da Consulta</label>
                <input
                  type="date"
                  required
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 font-bold outline-none focus:border-psi-vibrant"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Horário de Início</label>
                <input
                  type="time"
                  required
                  value={scheduleTime}
                  onChange={(e) => setScheduleTime(e.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 font-bold outline-none focus:border-psi-vibrant"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Modalidade</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleModality('online')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      scheduleModality === 'online'
                        ? 'border-psi-vibrant bg-psi-vibrant/10 text-psi-vibrant'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Atendimento Online
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleModality('presencial')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      scheduleModality === 'presencial'
                        ? 'border-psi-vibrant bg-psi-vibrant/10 text-psi-vibrant'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    Presencial
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPatientForSchedule(null)}
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-100 py-3 text-xs font-bold text-slate-700 hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSchedule}
                  className="flex-1 rounded-2xl bg-psi-vibrant py-3 text-xs font-black text-white hover:bg-psi-vibrant/90 flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {savingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Agendamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

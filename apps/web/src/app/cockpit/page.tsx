'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Zap,
  Check,
  Calendar,
  Copy,
  UserPlus,
  FileText,
  Share2,
  Send,
  AlertCircle,
  User,
  MessageCircle,
} from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import NewPatientModal from '@/components/patients/NewPatientModal';

interface PatientOption {
  id: string;
  displayName: string;
  phone?: string;
  status?: string;
  nextAppointmentAt?: string;
}

interface AppointmentSummary {
  id: string;
  patientId: string;
  pacienteNome?: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'canceled';
  modality: 'online' | 'presencial';
  prontuarioPreenchido?: boolean;
}

export default function CockpitPage() {
  const router = useRouter();

  // Dados Reais da Aplicação
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [agendaToken, setAgendaToken] = useState<string>('');
  const [selectedPatientForTimeline, setSelectedPatientForTimeline] = useState<string>('');

  // Estados de Modal e Cópia
  const [modalNovoPaciente, setModalNovoPaciente] = useState(false);
  const [copiedAgendaLink, setCopiedAgendaLink] = useState(false);

  useEffect(() => {
    // Carrega Pacientes
    applicationRequest<PatientOption[]>('/patients')
      .then((items) => {
        if (Array.isArray(items)) {
          setPatients(items);
          if (items.length > 0) setSelectedPatientForTimeline(items[0].id);
        }
      })
      .catch(() => {});

    // Carrega Token da Agenda
    applicationRequest<{ agendaToken?: string }>('/agenda')
      .then((res) => {
        if (res?.agendaToken) setAgendaToken(res.agendaToken);
      })
      .catch(() => {});

    // Carrega Sessões
    applicationRequest<AppointmentSummary[]>('/appointments')
      .then((apps) => {
        if (Array.isArray(apps)) setAppointments(apps);
      })
      .catch(() => {});
  }, []);

  const publicAgendaUrl = agendaToken
    ? `${typeof window !== 'undefined' ? window.location.origin : 'https://clinica-viver-web.vercel.app'}/agendar/${agendaToken}`
    : '';

  const handleCopyAgendaLink = () => {
    if (publicAgendaUrl) {
      navigator.clipboard.writeText(publicAgendaUrl);
      setCopiedAgendaLink(true);
      setTimeout(() => setCopiedAgendaLink(false), 3000);
    }
  };

  // Lembrete de Sessão em 1-Clique via WhatsApp
  const handleEnviarLembreteWhatsApp = (app: AppointmentSummary) => {
    const paciente = patients.find((p) => p.id === app.patientId);
    const telefone = paciente?.phone?.replace(/\D/g, '') || '';
    const nome = app.pacienteNome || paciente?.displayName || 'Paciente';

    const dataFormatada = new Date(app.startsAt).toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });
    const horaFormatada = new Date(app.startsAt).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    const mensagem = `Olá, ${nome}! 👋 Passando para lembrar da nossa sessão de psicologia agendada para ${dataFormatada} às ${horaFormatada}. Podemos confirmar? 😊`;

    const urlWpp = telefone
      ? `https://wa.me/${telefone}?text=${encodeURIComponent(mensagem)}`
      : `https://wa.me/?text=${encodeURIComponent(mensagem)}`;

    window.open(urlWpp, '_blank');
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Header do Meu Painel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Painel do Psicólogo — Viver Mais Psicologia</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <Zap className="w-6 h-6 text-psi-vibrant fill-psi-vibrant" />
            Meu Painel
          </h1>
          <p className="text-xs text-muted">
            Acompanhe suas pendências de atendimento, agendamentos do dia e prontuários.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setModalNovoPaciente(true)}
            className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            <span>Cadastrar Paciente</span>
          </button>
        </div>
      </div>

      {/* GRID DE CARDS PRINCIPAIS DO MEU PAINEL */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* CARD 1: ACESSO RÁPIDO AO PRONTUÁRIO DO PACIENTE */}
        <div className="bg-surface rounded-3xl p-5 border border-line shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">
              Prontuários Clínicos
            </span>
            <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
              <FileText className="w-5 h-5 text-psi-vibrant" /> Prontuário Rápido
            </h3>
          </div>

          <div className="space-y-3 bg-canvas p-3.5 rounded-2xl border border-line my-auto">
            <label className="text-xs font-bold text-ink block">
              Selecione o Paciente:
              <select
                value={selectedPatientForTimeline}
                onChange={(e) => setSelectedPatientForTimeline(e.target.value)}
                className="input mt-1 py-2 text-xs font-bold w-full"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
                {patients.length === 0 && <option value="">Nenhum paciente cadastrado</option>}
              </select>
            </label>

            <button
              type="button"
              disabled={!selectedPatientForTimeline}
              onClick={() => router.push(`/linha-do-tempo?patientId=${selectedPatientForTimeline}`)}
              className="w-full bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs py-2.5 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <FileText className="w-4 h-4" />
              <span>Abrir / Lançar Prontuário</span>
            </button>
          </div>
        </div>

        {/* CARD 2: COMPARTILHAR LINK PÚBLICO DA AGENDA */}
        <div className="bg-surface rounded-3xl p-5 border border-line shadow-card flex flex-col justify-between space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">
              Divulgação &amp; Agendamento
            </span>
            <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
              <Share2 className="w-5 h-5 text-psi-vibrant" /> Link da Sua Agenda
            </h3>
          </div>

          <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 my-auto">
            <p className="text-[11px] text-muted">
              Envie este link direto para seus pacientes agendarem nos seus horários livres:
            </p>
            <input
              type="text"
              readOnly
              value={publicAgendaUrl || 'Carregando seu link exclusivo…'}
              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-800 truncate"
            />
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleCopyAgendaLink}
                className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition-all"
              >
                {copiedAgendaLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAgendaLink ? 'Copiado!' : 'Copiar Link'}</span>
              </button>

              {publicAgendaUrl && (
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Olá! Agende sua consulta comigo na Viver Mais Psicologia pelo link: ${publicAgendaUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2 rounded-xl flex items-center justify-center gap-1 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Enviar Wpp</span>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* CARD DE PRÓXIMAS SESSÕES DA SEMANA + LEMBRETE 1-CLIQUE WHATSAPP */}
      <div className="bg-surface rounded-3xl p-6 border border-line shadow-card space-y-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-psi-vibrant" />
            <h3 className="font-extrabold text-base text-ink">Suas Próximas Sessões Agendadas</h3>
          </div>
          <button
            type="button"
            onClick={() => router.push('/agenda')}
            className="text-xs font-bold text-psi-vibrant hover:underline"
          >
            Ver grade completa →
          </button>
        </div>

        {appointments.length === 0 ? (
          <div className="bg-canvas p-6 rounded-2xl border border-line text-center space-y-2">
            <AlertCircle className="w-6 h-6 text-muted mx-auto" />
            <p className="text-xs font-bold text-ink">Nenhuma consulta pendente para os próximos dias.</p>
            <p className="text-[11px] text-muted">
              Compartilhe seu link público de agendamento ou adicione horários na sua agenda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {appointments.slice(0, 4).map((app) => (
              <div
                key={app.id}
                className="bg-canvas p-4 rounded-2xl border border-line flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-psi-vibrant/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center font-bold shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-ink">{app.pacienteNome || 'Paciente'}</h4>
                    <p className="text-[11px] text-muted capitalize">
                      {new Date(app.startsAt).toLocaleDateString('pt-BR', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                        timeZone: 'America/Sao_Paulo',
                      })}{' '}
                      às{' '}
                      {new Date(app.startsAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'America/Sao_Paulo',
                      })}
                      {' · '}
                      <span className="font-bold text-psi-vibrant">{app.modality}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    type="button"
                    onClick={() => handleEnviarLembreteWhatsApp(app)}
                    className="rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 p-2 text-xs font-bold text-emerald-800 flex items-center gap-1.5 transition-colors"
                    title="Enviar lembrete de confirmação via WhatsApp"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Lembrar Wpp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => router.push(`/linha-do-tempo?patientId=${app.patientId}`)}
                    className="rounded-xl border border-line bg-white hover:bg-slate-50 p-2 text-xs font-bold text-slate-700 flex items-center gap-1"
                  >
                    <FileText className="w-3.5 h-3.5 text-psi-vibrant" />
                    <span>Prontuário</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <NewPatientModal
        isOpen={modalNovoPaciente}
        onClose={() => setModalNovoPaciente(false)}
        onPatientCreated={async () => {
          const items = await applicationRequest<PatientOption[]>('/patients');
          setPatients(Array.isArray(items) ? items : []);
        }}
      />
    </div>
  );
}

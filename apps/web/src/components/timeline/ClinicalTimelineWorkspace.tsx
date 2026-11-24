'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ClinicalTimelineEntry } from '@thats-life/core';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import TimelineFeed from './TimelineFeed';
import TimelineHeader from './TimelineHeader';
import TimelineSectionTabs from './TimelineSectionTabs';
import EditPatientModal from '@/components/patients/EditPatientModal';
import type { PatientRegistrationRecord } from '@/lib/patientRegistrationDetails';
import { ManualRecordForm, RascunhoPendenteAviso } from './ManualRecordForm';
import { usePacientesDaLinhaDoTempo } from './usePacientesDaLinhaDoTempo';
import {
  corpoDoRascunho,
  daFichaAtiva,
  incorporarRegistrosSalvos,
  novoRascunho,
  rascunhoTemConteudo,
  type DaFicha,
  type RascunhoProntuario,
} from './fichaAtiva';
import {
  Plus,
  CheckCircle2,
  User,
  Clock,
  ArrowLeft,
  Calendar,
  CalendarPlus,
  Phone,
  Mail,
  Send,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';

interface AppointmentSummary {
  id: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'canceled';
  modality: 'online' | 'presencial';
}

interface SessoesDaFicha {
  itens: AppointmentSummary[];
  /** Instante em que a lista de sessões chegou — a régua do "que ainda vem". */
  carregadoEm: number;
  falhou?: boolean;
}

// Referências estáveis para "nada carregado", para não reiniciar memos a cada render.
const SEM_REGISTROS: ClinicalTimelineEntry[] = [];
const SEM_SESSOES: AppointmentSummary[] = [];

function ClinicalTimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPatientId = searchParams.get('patientId');

  const {
    patients, setPatients, encerrados, selectedPatientId, setSelectedPatientId, loadError,
  } = usePacientesDaLinhaDoTempo(urlPatientId);
  const [activeTab, setActiveTab] = useState<'prontuarios' | 'sessoes' | 'demanda'>('prontuarios');
  // Registros, sessões e falhas guardam o paciente a que pertencem: a tela só
  // mostra o que é da ficha ativa (especificação final, § 8.04).
  const [registros, setRegistros] = useState<DaFicha<ClinicalTimelineEntry[]> | null>(null);
  const [falhaRegistros, setFalhaRegistros] = useState<DaFicha<string> | null>(null);
  const [sessoes, setSessoes] = useState<DaFicha<SessoesDaFicha> | null>(null);

  // Prontuário manual: o rascunho nasce preso à ficha em que foi aberto.
  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);
  const [rascunho, setRascunho] = useState<RascunhoProntuario | null>(null);
  const [salvandoDe, setSalvandoDe] = useState<string | null>(null);
  const [falhaAoSalvar, setFalhaAoSalvar] = useState<DaFicha<string> | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string>();
  const [editandoPaciente, setEditandoPaciente] = useState(false);

  // Carrega Prontuário do Paciente Selecionado
  useEffect(() => {
    if (!selectedPatientId) return;
    const solicitado = selectedPatientId;
    let cancelled = false;
    applicationRequest<{ entries: ClinicalTimelineEntry[] }>(`/timeline?patientId=${encodeURIComponent(solicitado)}`)
      .then((data) => {
        if (cancelled) return;
        setRegistros({ patientId: solicitado, valor: data.entries });
        setFalhaRegistros((atual) => (atual?.patientId === solicitado ? null : atual));
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setFalhaRegistros({
            patientId: solicitado,
            valor: error instanceof Error ? error.message : 'Não foi possível carregar o prontuário.',
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  // Carrega Agendamentos/Sessões do Paciente
  useEffect(() => {
    if (!selectedPatientId) return;
    const solicitado = selectedPatientId;
    let cancelled = false;
    applicationRequest<AppointmentSummary[]>('/appointments')
      .then((items) => {
        if (cancelled) return;
        const itens = Array.isArray(items) ? items.filter((a) => a.patientId === solicitado) : [];
        // O relógio é lido junto com a chegada dos dados, e não durante a
        // renderização: dentro do render o valor mudaria a cada re-render,
        // e "a próxima sessão" passaria a depender de quantas vezes o React
        // decidiu redesenhar a tela.
        setSessoes({ patientId: solicitado, valor: { itens, carregadoEm: Date.now() } });
      })
      .catch(() => {
        if (!cancelled) setSessoes({ patientId: solicitado, valor: { itens: [], carregadoEm: Date.now(), falhou: true } });
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  const registrosDaFicha = daFichaAtiva(registros, selectedPatientId);
  const erroRegistros = daFichaAtiva(falhaRegistros, selectedPatientId);
  const carregandoRegistros = Boolean(selectedPatientId) && !registrosDaFicha && !erroRegistros;
  const allEntries = registrosDaFicha ?? SEM_REGISTROS;
  const sessoesDaFicha = daFichaAtiva(sessoes, selectedPatientId);
  const appointments = sessoesDaFicha?.itens ?? SEM_SESSOES;
  const carregadoEm = sessoesDaFicha?.carregadoEm ?? 0;

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  // Vínculo encerrado: só os próprios registros e complementos, sem cadastro (§ 8.05).
  const fichaEncerrada = !selectedPatient && encerrados.some((p) => p.patientId === selectedPatientId);
  const opcoesDoSeletor = useMemo(() => [
    ...patients,
    ...encerrados.map((p) => ({ id: p.patientId, displayName: `${p.displayName} (vínculo encerrado)` })),
  ], [patients, encerrados]);
  const nomeDoPaciente = (id: string) =>
    patients.find((p) => p.id === id)?.displayName
    || encerrados.find((p) => p.patientId === id)?.displayName
    || 'Paciente';
  const rascunhoDaFicha = rascunho?.patientId === selectedPatientId ? rascunho : null;
  const rascunhoDeOutraFicha =
    rascunho && rascunho.patientId !== selectedPatientId && rascunhoTemConteudo(rascunho) ? rascunho : null;

  // Próxima sessão agendada do paciente
  const nextAppointment = useMemo(() => {
    if (!selectedPatient?.nextAppointmentAt) {
      return appointments.find(
        (a) =>
          Date.parse(a.startsAt) >= carregadoEm &&
          (a.status === 'scheduled' || a.status === 'confirmed')
      );
    }
    return {
      id: 'next-1',
      patientId: selectedPatientId,
      startsAt: selectedPatient.nextAppointmentAt,
      endsAt: new Date(Date.parse(selectedPatient.nextAppointmentAt) + 50 * 60000).toISOString(),
      status: 'confirmed' as const,
      modality: 'online' as const,
    };
  }, [selectedPatient, appointments, selectedPatientId, carregadoEm]);

  const selecionarPaciente = (id: string) => {
    setSelectedPatientId(id);
    router.replace(`/linha-do-tempo?patientId=${id}`);
  };

  // Abre ou fecha o formulário da ficha ativa. Um rascunho com texto de outra
  // ficha só é substituído com confirmação, para nada se perder em silêncio.
  const alternarFormulario = () => {
    setActiveTab('prontuarios');
    if (!selectedPatientId) return;
    if (rascunhoDaFicha) {
      setMostrarFormNovo((aberto) => !aberto);
      return;
    }
    if (
      rascunhoDeOutraFicha &&
      !window.confirm(`Descartar o rascunho não salvo de ${nomeDoPaciente(rascunhoDeOutraFicha.patientId)} e começar um registro para ${nomeDoPaciente(selectedPatientId)}?`)
    ) {
      return;
    }
    setRascunho(novoRascunho(selectedPatientId));
    setMostrarFormNovo(true);
  };

  const voltarParaRascunho = () => {
    if (!rascunho) return;
    selecionarPaciente(rascunho.patientId);
    setMostrarFormNovo(true);
  };

  // Grava no paciente do rascunho, e não na ficha aberta na hora do clique.
  const handleSalvarProntuarioManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rascunho || salvandoDe) return;
    const origem = rascunho.patientId;

    setSalvandoDe(origem);
    setMensagemSucesso(undefined);
    setFalhaAoSalvar(null);

    try {
      const result = await applicationRequest<{ entries: ClinicalTimelineEntry[] }>('/timeline', {
        method: 'POST',
        headers: commandHeaders(),
        body: JSON.stringify(corpoDoRascunho(rascunho)),
      });
      setRegistros((atual) => incorporarRegistrosSalvos(atual, origem, result.entries));
      setMensagemSucesso(`Prontuário salvo no histórico de ${nomeDoPaciente(origem)}.`);
      setRascunho((atual) => (atual?.patientId === origem ? null : atual));
      setMostrarFormNovo(false);
    } catch (error) {
      setFalhaAoSalvar({
        patientId: origem,
        valor: error instanceof Error ? error.message : 'Não foi possível salvar o prontuário.',
      });
    } finally {
      setSalvandoDe(null);
    }
  };

  const statusLabelMap: Record<string, { label: string; class: string }> = {
    confirmed: { label: 'Confirmada', class: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
    scheduled: { label: 'Agendada', class: 'bg-sky-100 text-sky-800 border-sky-200' },
    completed: { label: 'Realizada', class: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
    canceled: { label: 'Cancelada', class: 'bg-rose-100 text-rose-800 border-rose-200' },
  };

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-12">
      {/* Barra de Ações Rápidas */}
      <div className="grid grid-cols-1 gap-2 sm:flex sm:items-center sm:justify-between">
        <button
          onClick={() => router.push('/pacientes')}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition-colors hover:text-psi-vibrant sm:justify-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Meus Pacientes</span>
        </button>

        <button
          onClick={alternarFormulario}
          className="flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-psi-vibrant px-4 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-psi-vibrant/30 transition-all hover:bg-psi-vibrant/90"
        >
          <Plus className="w-4 h-4" />
          <span>{fichaEncerrada ? 'Registrar Complemento' : 'Registrar Prontuário Manual'}</span>
        </button>
      </div>

      {/* Header com Seletor de Pacientes */}
      <TimelineHeader
        selectedPatientId={selectedPatientId}
        onSelectPatient={selecionarPaciente}
        patients={opcoesDoSeletor}
        entriesCount={registrosDaFicha?.length}
        onEditPatient={selectedPatient ? () => setEditandoPaciente(true) : undefined}
      />

      {(loadError || erroRegistros) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-bold">
          {loadError ?? erroRegistros}
        </div>
      )}

      {fichaEncerrada && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-bold text-sky-900">
          Vínculo encerrado. Você vê somente os registros que fez enquanto atendia este paciente e pode acrescentar
          complementos. Os dados cadastrais ficam com o profissional responsável.
        </div>
      )}

      {rascunhoDeOutraFicha && (
        <RascunhoPendenteAviso
          patientName={nomeDoPaciente(rascunhoDeOutraFicha.patientId)}
          onVoltar={voltarParaRascunho}
          onDescartar={() => setRascunho(null)}
        />
      )}

      {mensagemSucesso && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {mensagemSucesso}
        </div>
      )}

      {editandoPaciente && selectedPatient && (
        <EditPatientModal
          patientId={selectedPatient.id}
          patientName={selectedPatient.displayName}
          onClose={() => setEditandoPaciente(false)}
          onSaved={(updated: PatientRegistrationRecord) => {
            setPatients((current) => current.map((patient) => patient.id === updated.patientId
              ? { ...patient, displayName: updated.displayName, phone: updated.phone, email: updated.email }
              : patient));
            setMensagemSucesso('Dados cadastrais atualizados com auditoria.');
          }}
        />
      )}

      {/* Cartão de Ficha do Paciente e Próxima Sessão */}
      {selectedPatient && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Informações do Paciente e Demanda */}
          <div className="md:col-span-2 bg-white rounded-3xl border border-line p-5 shadow-card space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-line pb-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center font-bold">
                  <User className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h3 className="truncate font-extrabold text-base text-ink">{selectedPatient.displayName}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted mt-0.5">
                    {selectedPatient.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-psi-vibrant" /> {selectedPatient.phone}
                      </span>
                    )}
                    {selectedPatient.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-psi-vibrant" /> {selectedPatient.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {selectedPatient.phone && (
                <a
                  href={`https://wa.me/${selectedPatient.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 p-2 text-xs font-bold text-emerald-800 flex items-center gap-1.5 transition-colors"
                >
                  <Send className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
            </div>

            {/* Demanda Principal / Observações Clínicas */}
            <div className="bg-canvas p-4 rounded-2xl border border-line space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant flex items-center gap-1">
                <ClipboardList className="w-3.5 h-3.5" /> Demanda &amp; Queixa Principal
              </span>
              <p className={`text-xs font-semibold leading-relaxed ${selectedPatient.demanda ? 'text-slate-800' : 'text-muted italic'}`}>
                {selectedPatient.demanda || 'Não informada'}
              </p>
            </div>
          </div>

          {/* Status da Próxima Sessão */}
          <div className="bg-gradient-to-br from-slate-900 via-psi-darkest to-slate-900 rounded-3xl p-5 text-white shadow-card flex flex-col justify-between space-y-4">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-psi-soft bg-psi-vibrant/20 px-2.5 py-0.5 rounded-full border border-psi-vibrant/30">
                Agendamento
              </span>
              <h4 className="font-extrabold text-sm text-white flex items-center gap-2 mt-2">
                <Calendar className="w-4 h-4 text-psi-vibrant" /> Próxima Sessão
              </h4>
            </div>

            {nextAppointment ? (
              <div className="bg-white/10 p-3.5 rounded-2xl border border-white/15 space-y-1">
                <p className="text-xs font-black text-psi-soft capitalize">
                  {new Date(nextAppointment.startsAt).toLocaleDateString('pt-BR', {
                    weekday: 'long',
                    day: '2-digit',
                    month: 'long',
                    timeZone: 'America/Sao_Paulo',
                  })}
                </p>
                <p className="text-base font-black text-white">
                  {new Date(nextAppointment.startsAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'America/Sao_Paulo',
                  })}
                </p>
                <span className="inline-block text-[10px] font-bold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md mt-1">
                  Atendimento Confirmado
                </span>
              </div>
            ) : (
              <div className="bg-white/5 p-3.5 rounded-2xl border border-white/10 space-y-2 text-center">
                <AlertCircle className="w-5 h-5 text-amber-400 mx-auto" />
                <p className="text-xs text-slate-300">Nenhuma sessão futura agendada.</p>
                <button
                  onClick={() => router.push('/agenda')}
                  className="btn-accent py-2 px-3 text-xs w-full justify-center"
                >
                  <CalendarPlus className="w-3.5 h-3.5" /> Abrir Agenda
                </button>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-300 border-t border-white/10 pt-2">
              <span>Sessões Concluídas:</span>
              <strong className="text-white text-sm">{selectedPatient.completedSessions || appointments.filter(a => a.status === 'completed').length}</strong>
            </div>
          </div>
        </div>
      )}

      <TimelineSectionTabs active={activeTab === 'sessoes' ? 'sessoes' : 'prontuarios'} recordsCount={allEntries.length} sessionsCount={appointments.length} onChange={setActiveTab} />

      {/* Formulário de Prontuário Clínico Manual — só na ficha do rascunho */}
      {mostrarFormNovo && rascunhoDaFicha && (
        <ManualRecordForm
          patientName={nomeDoPaciente(rascunhoDaFicha.patientId)}
          rascunho={rascunhoDaFicha}
          onChange={setRascunho}
          onCancel={() => setMostrarFormNovo(false)}
          onSubmit={handleSalvarProntuarioManual}
          salvando={salvandoDe === rascunhoDaFicha.patientId}
          erro={daFichaAtiva(falhaAoSalvar, rascunhoDaFicha.patientId)}
          complemento={fichaEncerrada}
        />
      )}

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'prontuarios' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white px-4 py-3 shadow-card">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                Histórico de Prontuários
              </p>
              <p className="text-xs text-ink font-bold">
                {carregandoRegistros
                  ? 'Carregando os registros desta ficha…'
                  : erroRegistros
                    ? 'Os registros desta ficha não puderam ser carregados.'
                    : `${allEntries.length} registro(s) no prontuário do paciente`}
              </p>
            </div>
          </div>

          {registrosDaFicha && <TimelineFeed entries={registrosDaFicha} />}
        </div>
      )}

      {activeTab === 'sessoes' && (
        <div className="space-y-4 rounded-3xl border border-line bg-white p-4 shadow-card sm:p-6">
          <div className="flex flex-col gap-1 border-b border-line pb-3 sm:flex-row sm:items-center sm:justify-between">
            <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-psi-vibrant" /> Histórico Completo de Sessões do Paciente
            </h4>
            <span className="text-xs text-slate-500 font-bold">{appointments.length} Sessão(ões)</span>
          </div>

          {!sessoesDaFicha || sessoesDaFicha.falhou || appointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center bg-canvas rounded-2xl border border-line">
              {!sessoesDaFicha
                ? 'Carregando as sessões deste paciente…'
                : sessoesDaFicha.falhou
                  ? 'Não foi possível carregar as sessões deste paciente.'
                  : 'Nenhuma sessão registrada no histórico deste paciente até o momento.'}
            </p>
          ) : (
            <div className="space-y-3">
              {appointments.map((app) => {
                const badge = statusLabelMap[app.status] || {
                  label: app.status,
                  class: 'bg-slate-100 text-slate-700',
                };
                return (
                  <div
                    key={app.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl border border-line bg-canvas/40 hover:border-psi-vibrant/30 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center font-bold">
                        <Calendar className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-black text-xs text-slate-900 capitalize">
                          {new Date(app.startsAt).toLocaleDateString('pt-BR', {
                            weekday: 'long',
                            day: '2-digit',
                            month: 'long',
                            year: 'numeric',
                            timeZone: 'America/Sao_Paulo',
                          })}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Horário:{' '}
                          {new Date(app.startsAt).toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'America/Sao_Paulo',
                          })}{' '}
                          · Modalidade: <span className="capitalize">{app.modality}</span>
                        </p>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-extrabold px-3 py-1 rounded-full border ${badge.class}`}
                    >
                      {badge.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ClinicalTimelineWorkspace() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs text-muted">Carregando prontuário do paciente...</div>}>
      <ClinicalTimelineContent />
    </Suspense>
  );
}

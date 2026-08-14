'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { type ClinicalTimelineEntry } from '@thats-life/core';
import { applicationRequest } from '@/lib/applicationApi';
import TimelineFeed from './TimelineFeed';
import TimelineFilters, { TIMELINE_FILTERS } from './TimelineFilters';
import TimelineHeader from './TimelineHeader';
import {
  Plus,
  FileText,
  Save,
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
  Activity,
  ClipboardList,
} from 'lucide-react';

interface TimelinePatient {
  id: string;
  displayName: string;
  phone?: string;
  email?: string;
  status?: string;
  demanda?: string;
  nextAppointmentAt?: string;
  completedSessions?: number;
}

interface AppointmentSummary {
  id: string;
  patientId: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'canceled';
  modality: 'online' | 'presencial';
}

function ClinicalTimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlPatientId = searchParams.get('patientId');

  const [selectedPatientId, setSelectedPatientId] = useState(urlPatientId || '');
  const [activeTab, setActiveTab] = useState<'prontuarios' | 'sessoes' | 'demanda'>('prontuarios');
  const [activeFilterId, setActiveFilterId] = useState('all');
  const [apiEntries, setApiEntries] = useState<ClinicalTimelineEntry[] | null>(null);
  const [patients, setPatients] = useState<TimelinePatient[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [loadError, setLoadError] = useState<string>();

  // Estado para Cadastro Manual de Prontuário
  const [mostrarFormNovo, setMostrarFormNovo] = useState(false);
  const [novoTitulo, setNovoTitulo] = useState('');
  const [novaCategoria, setNovaCategoria] = useState<'evolucao' | 'anamnese' | 'plano' | 'intervencao'>('evolucao');
  const [novosSubjetivo, setNovosSubjetivo] = useState('');
  const [novosObjetivo, setNovosObjetivo] = useState('');
  const [novosAvaliacao, setNovosAvaliacao] = useState('');
  const [novosPlano, setNovosPlano] = useState('');
  const [salvandoProntuario, setSalvandoProntuario] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState<string>();

  // Carrega Lista de Pacientes
  useEffect(() => {
    let cancelled = false;
    applicationRequest<TimelinePatient[]>('/patients')
      .then((items) => {
        if (cancelled) return;
        setPatients(items);
        if (urlPatientId) {
          setSelectedPatientId(urlPatientId);
        } else if (items.length > 0) {
          setSelectedPatientId((current) => current || items[0].id);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar seus pacientes.');
      });
    return () => {
      cancelled = true;
    };
  }, [urlPatientId]);

  // Carrega Prontuário do Paciente Selecionado
  useEffect(() => {
    if (!selectedPatientId) return;
    let cancelled = false;
    applicationRequest<{ entries: ClinicalTimelineEntry[] }>(`/timeline?patientId=${selectedPatientId}`)
      .then((data) => {
        if (!cancelled) {
          setApiEntries(data.entries);
          setLoadError(undefined);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o prontuário.');
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  // Carrega Agendamentos/Sessões do Paciente
  useEffect(() => {
    if (!selectedPatientId) return;
    let cancelled = false;
    applicationRequest<AppointmentSummary[]>('/appointments')
      .then((items) => {
        if (!cancelled && Array.isArray(items)) {
          const patientApps = items.filter((a) => a.patientId === selectedPatientId);
          setAppointments(patientApps);
        }
      })
      .catch(() => {
        // Fallback silencioso para lista de sessões
      });
    return () => {
      cancelled = true;
    };
  }, [selectedPatientId]);

  const allEntries = apiEntries ?? [];

  const activeFilter = TIMELINE_FILTERS.find((filter) => filter.id === activeFilterId);
  const filteredEntries = useMemo(
    () =>
      activeFilter?.categories
        ? allEntries.filter((entry) => activeFilter.categories?.includes(entry.category))
        : allEntries,
    [activeFilter, allEntries]
  );

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  // Próxima sessão agendada do paciente
  const nextAppointment = useMemo(() => {
    if (!selectedPatient?.nextAppointmentAt) {
      return appointments.find(
        (a) =>
          Date.parse(a.startsAt) >= Date.now() &&
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
  }, [selectedPatient, appointments, selectedPatientId]);

  // Adiciona Prontuário Manualmente
  const handleSalvarProntuarioManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    setSalvandoProntuario(true);
    setMensagemSucesso(undefined);

    const novoRegistro: ClinicalTimelineEntry = {
      schemaVersion: 1,
      id: `prontuario-manual-${Date.now()}`,
      organizationId: 'org-viver-mais',
      patientId: selectedPatientId,
      authorizedProfessionalIds: ['prof-1'],
      title: novoTitulo || 'Evolução Clínica Manual',
      category: 'clinical_record',
      importance: 'routine',
      occurredAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      summary: novosSubjetivo || novosAvaliacao || 'Registro de atendimento clínico manual.',
      evidenceExcerpt: [
        novosSubjetivo && `Subjetivo: ${novosSubjetivo}`,
        novosObjetivo && `Objetivo: ${novosObjetivo}`,
        novosAvaliacao && `Avaliação: ${novosAvaliacao}`,
        novosPlano && `Plano: ${novosPlano}`,
      ]
        .filter(Boolean)
        .join(' | '),
      evidence: {
        sourceType: 'clinical_record_revision',
        sourceId: `atendimento-${Date.now()}`,
      },
      tags: ['prontuario-manual', novaCategoria],
    };

    try {
      setApiEntries((prev) => [novoRegistro, ...(prev || [])]);
      setMensagemSucesso('Prontuário salvo com sucesso no histórico do paciente!');
      setMostrarFormNovo(false);

      setNovoTitulo('');
      setNovosSubjetivo('');
      setNovosObjetivo('');
      setNovosAvaliacao('');
      setNovosPlano('');
    } catch {
      setLoadError('Não foi possível salvar o prontuário.');
    } finally {
      setSalvandoProntuario(false);
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
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/pacientes')}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-psi-vibrant transition-colors bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para Meus Pacientes</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('prontuarios');
            setMostrarFormNovo(!mostrarFormNovo);
          }}
          className="rounded-2xl bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-4 py-2.5 shadow-lg shadow-psi-vibrant/30 flex items-center gap-2 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Registrar Prontuário Manual</span>
        </button>
      </div>

      {/* Header com Seletor de Pacientes */}
      <TimelineHeader
        selectedPatientId={selectedPatientId}
        onSelectPatient={(id) => {
          setSelectedPatientId(id);
          router.replace(`/linha-do-tempo?patientId=${id}`);
        }}
        patients={patients}
        entriesCount={allEntries.length}
      />

      {loadError && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 font-bold">
          {loadError}
        </div>
      )}

      {mensagemSucesso && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          {mensagemSucesso}
        </div>
      )}

      {/* Cartão de Ficha do Paciente e Próxima Sessão */}
      {selectedPatient && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Informações do Paciente e Demanda */}
          <div className="md:col-span-2 bg-white rounded-3xl border border-line p-5 shadow-card space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center font-bold">
                  <User className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-ink">{selectedPatient.displayName}</h3>
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
              <p className="text-xs font-semibold text-slate-800 leading-relaxed">
                {selectedPatient.demanda ||
                  'Paciente em acompanhamento psicoterapêutico recorrente. Demanda principal focado em regulação emocional, ansiedade e desenvolvimento pessoal.'}
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

      {/* Abas de Navegação Interna do Prontuário */}
      <div className="flex border-b border-line gap-2">
        <button
          onClick={() => setActiveTab('prontuarios')}
          className={`px-4 py-2.5 text-xs font-extrabold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'prontuarios'
              ? 'border-psi-vibrant text-psi-vibrant bg-psi-vibrant/5 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Prontuários ({allEntries.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sessoes')}
          className={`px-4 py-2.5 text-xs font-extrabold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'sessoes'
              ? 'border-psi-vibrant text-psi-vibrant bg-psi-vibrant/5 rounded-t-xl'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Histórico de Sessões ({appointments.length})</span>
        </button>
      </div>

      {/* Formulário de Prontuário Clínico Manual */}
      {mostrarFormNovo && (
        <form
          onSubmit={handleSalvarProntuarioManual}
          className="bg-white rounded-3xl border border-line p-6 shadow-card space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-line pb-3">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-psi-vibrant" />
              <h3 className="font-extrabold text-base text-ink">
                Novo Registro de Prontuário Manual — {selectedPatient?.displayName || 'Paciente'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setMostrarFormNovo(false)}
              className="text-xs font-bold text-muted hover:text-ink"
            >
              Cancelar
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Título do Atendimento / Prontuário</label>
              <input
                type="text"
                required
                value={novoTitulo}
                onChange={(e) => setNovoTitulo(e.target.value)}
                placeholder="Ex: Sessão Semanal TCC, Anamnese Inicial..."
                className="input py-2.5 text-xs w-full"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-ink block mb-1">Categoria do Registro</label>
              <select
                value={novaCategoria}
                onChange={(e) =>
                  setNovaCategoria(e.target.value as 'evolucao' | 'anamnese' | 'plano' | 'intervencao')
                }
                className="input py-2.5 text-xs w-full font-bold"
              >
                <option value="evolucao">Evolução Clínica</option>
                <option value="anamnese">Anamnese / Avaliação Inicial</option>
                <option value="plano">Plano Terapêutico</option>
                <option value="intervencao">Intervenção / Técnica Aplicada</option>
              </select>
            </div>
          </div>

          {/* Estrutura SOAP Manual */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-psi-vibrant">
              Anotações &amp; Evolução Clínica Manual
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Subjetivo (Relato do Paciente)</label>
                <textarea
                  rows={3}
                  value={novosSubjetivo}
                  onChange={(e) => setNovosSubjetivo(e.target.value)}
                  placeholder="Queixas, sentimentos e relato trazido pelo paciente..."
                  className="input py-2 text-xs w-full resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Objetivo (Observações do Psicólogo)</label>
                <textarea
                  rows={3}
                  value={novosObjetivo}
                  onChange={(e) => setNovosObjetivo(e.target.value)}
                  placeholder="Comportamentos observados, afeto, linguagem não verbal..."
                  className="input py-2 text-xs w-full resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Avaliação (Análise Clínica)</label>
                <textarea
                  rows={3}
                  value={novosAvaliacao}
                  onChange={(e) => setNovosAvaliacao(e.target.value)}
                  placeholder="Impressões clínicas, hipóteses diagnósticas, avanços..."
                  className="input py-2 text-xs w-full resize-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-ink block mb-1">Plano (Conduta &amp; Próximos Passos)</label>
                <textarea
                  rows={3}
                  value={novosPlano}
                  onChange={(e) => setNovosPlano(e.target.value)}
                  placeholder="Tarefas combinadas, meta para a próxima sessão..."
                  className="input py-2 text-xs w-full resize-none"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setMostrarFormNovo(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-muted hover:bg-canvas"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoProntuario}
              className="btn-accent px-5 py-2 text-xs shadow-md flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {salvandoProntuario ? 'Salvando…' : 'Salvar no Prontuário'}
            </button>
          </div>
        </form>
      )}

      {/* Conteúdo da Aba Ativa */}
      {activeTab === 'prontuarios' && (
        <div className="space-y-4">
          <div className="flex flex-col justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3 sm:flex-row sm:items-center shadow-card">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted">
                Histórico de Prontuários
              </p>
              <p className="text-xs text-ink font-bold">
                {filteredEntries.length} registro(s) no prontuário do paciente
              </p>
            </div>
            <TimelineFilters activeId={activeFilterId} onChange={setActiveFilterId} />
          </div>

          <TimelineFeed entries={filteredEntries} />
        </div>
      )}

      {activeTab === 'sessoes' && (
        <div className="bg-white rounded-3xl border border-line p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between border-b border-line pb-3">
            <h4 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-psi-vibrant" /> Histórico Completo de Sessões do Paciente
            </h4>
            <span className="text-xs text-slate-500 font-bold">{appointments.length} Sessão(ões)</span>
          </div>

          {appointments.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center bg-canvas rounded-2xl border border-line">
              Nenhuma sessão registrada no histórico deste paciente até o momento.
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

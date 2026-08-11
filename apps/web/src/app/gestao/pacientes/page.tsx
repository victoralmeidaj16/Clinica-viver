'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Search, ShieldCheck, UserRoundX, UsersRound } from 'lucide-react';
import PatientManagementDrawer from '@/components/patients/PatientManagementDrawer';
import type { ManagedPatient, ManagedPsychologist, PatientManagementStatus } from '@/components/patients/managementTypes';

type FilterStatus = 'TODOS' | PatientManagementStatus;

const statusLabel: Record<PatientManagementStatus, string> = {
  EM_TRIAGEM: 'Em triagem', ATIVO: 'Ativo', ALTA: 'Alta', DESISTENTE: 'Desistente',
};

const statusClass: Record<PatientManagementStatus, string> = {
  EM_TRIAGEM: 'bg-amber-50 text-amber-800 border-amber-200',
  ATIVO: 'bg-teal-50 text-teal-800 border-teal-200',
  ALTA: 'bg-blue-50 text-blue-800 border-blue-200',
  DESISTENTE: 'bg-rose-50 text-rose-800 border-rose-200',
};

export default function GestaoPacientesPage() {
  const [patients, setPatients] = useState<ManagedPatient[]>([]);
  const [psychologists, setPsychologists] = useState<ManagedPsychologist[]>([]);
  const [selected, setSelected] = useState<ManagedPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FilterStatus>('TODOS');
  const [psychologist, setPsychologist] = useState('TODOS');
  const [mode, setMode] = useState('TODAS');
  const [slaOnly, setSlaOnly] = useState(false);
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const response = await fetch('/api/application/gestao/pacientes', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? 'Falha ao carregar pacientes.');
      setPatients(Array.isArray(body.data) ? body.data : []);
      setPsychologists(Array.isArray(body.psicologos) ? body.psicologos : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Falha ao carregar pacientes.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => patients.filter((patient) => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = !query || [patient.nome, patient.whatsapp, patient.protocolo, patient.psicologoNome]
      .some((value) => value?.toLocaleLowerCase('pt-BR').includes(query));
    return matchesSearch
      && (status === 'TODOS' || patient.status === status)
      && (psychologist === 'TODOS' || patient.psicologoId === psychologist)
      && (mode === 'TODAS' || patient.modalidade === mode)
      && (!slaOnly || patient.slaStatus === 'ESTOURADO')
      && (!unassignedOnly || patient.slaStatus === 'SEM_ALOCACAO');
  }), [mode, patients, psychologist, search, slaOnly, status, unassignedOnly]);

  const modes = [...new Set(patients.map((patient) => patient.modalidade).filter(Boolean))] as string[];
  const overdue = patients.filter((patient) => patient.slaStatus === 'ESTOURADO').length;
  const unassigned = patients.filter((patient) => patient.slaStatus === 'SEM_ALOCACAO').length;
  const active = patients.filter((patient) => patient.status === 'ATIVO').length;

  const reassign = async (patientId: string, professionalId: string, reason: string) => {
    const response = await fetch('/api/application/patients', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: patientId, professionalId, motivo: reason }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message ?? 'Falha ao reatribuir paciente.');
    await load();
    setSelected(null);
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-5">
      <header className="relative overflow-hidden rounded-[28px] bg-slate-950 p-7 text-white shadow-xl">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[42px] border-teal-400/10" />
        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-teal-300"><ShieldCheck className="h-4 w-4" /> Operação sem acesso ao prontuário</p>
            <h1 className="mt-3 font-serif text-4xl font-bold tracking-tight">Gestão de pacientes</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Da primeira triagem ao acompanhamento: alocação, espera, agenda e situação financeira em uma única fila operacional.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Kpi label="Ativos" value={active} icon={UsersRound} tone="text-teal-300" />
            <Kpi label="SLA +24h" value={overdue} icon={Clock3} tone="text-amber-300" />
            <Kpi label="Sem alocação" value={unassigned} icon={UserRoundX} tone="text-rose-300" />
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-stone-200 bg-[#fbfaf7] p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_210px_170px_auto]">
          <label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone, protocolo…" className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm" /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value as FilterStatus)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"><option value="TODOS">Todos os status</option>{Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <select value={psychologist} onChange={(event) => setPsychologist(event.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"><option value="TODOS">Todos os psicólogos</option>{psychologists.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          <select value={mode} onChange={(event) => setMode(event.target.value)} className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm"><option value="TODAS">Modalidades</option>{modes.map((item) => <option key={item}>{item}</option>)}</select>
          <div className="flex gap-2"><Toggle active={slaOnly} onClick={() => setSlaOnly(!slaOnly)}>SLA estourado</Toggle><Toggle active={unassignedOnly} onClick={() => setUnassignedOnly(!unassignedOnly)}>Sem alocação</Toggle></div>
        </div>
      </section>

      {error && <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800"><AlertTriangle className="h-4 w-4" />{error}</div>}

      <section className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        <div className="border-b border-stone-200 px-5 py-3 text-xs font-bold text-slate-500">{loading ? 'Carregando…' : `${filtered.length} de ${patients.length} registros`}</div>
        {!loading && filtered.length === 0 ? <div className="p-16 text-center text-sm text-slate-500">Nenhum paciente corresponde aos filtros.</div> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-stone-50 text-[10px] font-black uppercase tracking-[0.14em] text-slate-500"><tr><th className="p-4">Paciente</th><th className="p-4">Demanda</th><th className="p-4">Responsável</th><th className="p-4">Espera</th><th className="p-4">Agenda</th><th className="p-4">Status</th></tr></thead><tbody className="divide-y divide-stone-100">{filtered.map((patient) => <tr key={patient.id} onClick={() => setSelected(patient)} className="cursor-pointer transition-colors hover:bg-teal-50/40"><td className="p-4"><p className="font-black text-slate-900">{patient.nome}</p><p className="mt-1 text-xs text-slate-500">{patient.whatsapp || 'Sem contato'} · {patient.protocolo || 'cadastro direto'}</p></td><td className="p-4"><p className="font-semibold text-slate-800">{patient.servicoNome ?? patient.servicoKey ?? 'Não informado'}</p><p className="mt-1 text-xs text-slate-500">{patient.modalidade ?? 'Modalidade pendente'}</p></td><td className="p-4 font-semibold text-slate-700">{patient.psicologoNome ?? <span className="text-amber-700">Aguardando alocação</span>}</td><td className="p-4"><Wait patient={patient} /></td><td className="p-4"><p className="font-bold text-slate-800">{patient.agenda.realizadas} realizadas</p><p className="mt-1 text-xs text-slate-500">{patient.agenda.proximaEm ? `Próxima ${new Date(patient.agenda.proximaEm).toLocaleDateString('pt-BR')}` : 'Sem próxima sessão'}</p></td><td className="p-4"><span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass[patient.status]}`}>{statusLabel[patient.status]}</span></td></tr>)}</tbody></table></div>
        )}
      </section>

      <PatientManagementDrawer key={selected?.id ?? 'closed'} patient={selected} psychologists={psychologists} onClose={() => setSelected(null)} onReassign={reassign} />
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof UsersRound; tone: string }) { return <div className="min-w-24 rounded-xl border border-white/10 bg-white/5 p-3"><Icon className={`h-4 w-4 ${tone}`} /><p className="mt-3 text-2xl font-black">{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div>; }
function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button onClick={onClick} className={`rounded-xl border px-3 py-2 text-[10px] font-black ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-stone-200 bg-white text-slate-600'}`}>{children}</button>; }
function Wait({ patient }: { patient: ManagedPatient }) { if (patient.slaStatus === 'SEM_ALOCACAO') return <span className="font-bold text-rose-700">Sem alocação</span>; if (!patient.horasEspera) return <span className="text-slate-400">Concluída</span>; return <span className={patient.horasEspera >= 24 ? 'font-black text-amber-700' : 'font-bold text-slate-700'}>{patient.horasEspera}h {patient.horasEspera >= 24 && '· prioridade'}</span>; }

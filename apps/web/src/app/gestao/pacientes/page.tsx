'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownWideNarrow, Clock3, HeartHandshake, Search, ShieldCheck, UserRoundX, UsersRound, UserX } from 'lucide-react';
import PatientManagementDrawer from '@/components/patients/PatientManagementDrawer';
import type { ManagedPatient, ManagedPsychologist, PatientManagementStatus } from '@/components/patients/managementTypes';

type FilterStatus = 'TODOS' | PatientManagementStatus;
type SortKey = 'ESPERA' | 'ENTRADA' | 'NOME';

const SORT_LABEL: Record<SortKey, string> = {
  ESPERA: 'Maior espera',
  ENTRADA: 'Entrada mais recente',
  NOME: 'Nome (A–Z)',
};

/**
 * Rótulo do convênio para agrupar e filtrar.
 */
function agreementOf(patient: ManagedPatient): string {
  const value = patient.convenioSelecionado?.trim();
  if (!value || value.toLocaleLowerCase('pt-BR') === 'nenhum') return 'Sem convênio';
  return value;
}

const statusLabel: Record<PatientManagementStatus, string> = {
  EM_TRIAGEM: 'Em triagem', ATIVO: 'Ativo', ALTA: 'Alta', DESISTENTE: 'Desistente',
};

const statusClass: Record<PatientManagementStatus, string> = {
  EM_TRIAGEM: 'bg-amber-500/10 text-amber-800 border-amber-500/30',
  ATIVO: 'bg-psi-soft text-psi-deep border-psi-vibrant/30 font-bold',
  ALTA: 'bg-sky-500/10 text-sky-800 border-sky-500/30',
  DESISTENTE: 'bg-rose-500/10 text-rose-800 border-rose-500/30',
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
  const [agreement, setAgreement] = useState('TODOS');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState<SortKey>('ESPERA');

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

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    const fromTime = from ? Date.parse(`${from}T00:00:00`) : null;
    const toTime = to ? Date.parse(`${to}T23:59:59.999`) : null;

    const visible = patients.filter((patient) => {
      const matchesSearch = !query || [patient.nome, patient.whatsapp, patient.protocolo, patient.psicologoNome]
        .some((value) => value?.toLocaleLowerCase('pt-BR').includes(query));
      const entrada = patient.criadoEm ? Date.parse(patient.criadoEm) : null;
      return matchesSearch
        && (status === 'TODOS' || patient.status === status)
        && (psychologist === 'TODOS' || patient.psicologoId === psychologist)
        && (mode === 'TODAS' || patient.modalidade === mode)
        && (agreement === 'TODOS' || agreementOf(patient) === agreement)
        && (fromTime === null || (entrada !== null && entrada >= fromTime))
        && (toTime === null || (entrada !== null && entrada <= toTime))
        && (!slaOnly || patient.slaStatus === 'ESTOURADO')
        && (!unassignedOnly || patient.slaStatus === 'SEM_ALOCACAO');
    });

    return [...visible].sort((a, b) => {
      if (sort === 'NOME') return a.nome.localeCompare(b.nome, 'pt-BR');
      if (sort === 'ENTRADA') {
        return (b.criadoEm ? Date.parse(b.criadoEm) : 0) - (a.criadoEm ? Date.parse(a.criadoEm) : 0);
      }
      const peso = (item: ManagedPatient) =>
        item.slaStatus === 'SEM_ALOCACAO' ? Number.MAX_SAFE_INTEGER : item.horasEspera;
      return peso(b) - peso(a);
    });
  }, [agreement, from, mode, patients, psychologist, search, slaOnly, sort, status, to, unassignedOnly]);

  const modes = [...new Set(patients.map((patient) => patient.modalidade).filter(Boolean))] as string[];
  const agreements = [...new Set(patients.map(agreementOf))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const overdue = patients.filter((patient) => patient.slaStatus === 'ESTOURADO').length;
  const unassigned = patients.filter((patient) => patient.slaStatus === 'SEM_ALOCACAO').length;
  const active = patients.filter((patient) => patient.status === 'ATIVO').length;

  // As duas métricas que a página `/retencao` calculava e que não podiam se
  // perder na mudança: quantas saídas houve e quantas voltaram.
  const dropouts = patients.filter((patient) => patient.desistencia);
  const reengaged = dropouts.filter((patient) => patient.desistencia?.reengajado).length;
  const reengagedRate = dropouts.length > 0 ? Math.round((reengaged / dropouts.length) * 100) : 0;

  // O drawer precisa acompanhar a recarga: registrar a desistência troca o
  // conteúdo de `patients`, e sem reencontrar a linha pelo id o painel
  // continuaria exibindo o paciente como estava antes do registro.
  const selectedPatient = selected ? patients.find((patient) => patient.id === selected.id) ?? selected : null;

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
      {/* Header do Gestão de Pacientes no Branding da Plataforma */}
      <header className="relative overflow-hidden rounded-[28px] bg-psi-darkest p-6 sm:p-7 text-white shadow-contrast">
        <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[42px] border-psi-vibrant/15 pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-48 w-48 rounded-full bg-psi-vibrant/10 blur-2xl pointer-events-none" />

        <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-psi-vibrant">
              <ShieldCheck className="h-4 w-4 text-psi-vibrant" /> Operação sem acesso ao prontuário
            </p>
            <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Gestão de Pacientes
            </h1>
            <p className="mt-2 max-w-2xl text-xs sm:text-sm text-psi-soft/80 leading-relaxed">
              Da primeira triagem ao acompanhamento: alocação, espera, agenda e situação financeira em uma única fila operacional.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-5">
            <Kpi label="Ativos" value={active} icon={UsersRound} tone="text-psi-vibrant" />
            <Kpi label="SLA +24h" value={overdue} icon={Clock3} tone="text-amber-300" />
            <Kpi label="Sem alocação" value={unassigned} icon={UserRoundX} tone="text-rose-300" />
            <Kpi label="Desistências" value={dropouts.length} icon={UserX} tone="text-rose-300" />
            <Kpi
              label={`Reengajados · ${reengagedRate}%`}
              value={reengaged}
              icon={HeartHandshake}
              tone="text-emerald-300"
            />
          </div>
        </div>
      </header>

      {/* Painel de Filtros e Busca */}
      <section className="rounded-2xl border border-psi-soft/60 bg-surface p-4 shadow-card">
        <div className="grid gap-3 lg:grid-cols-[minmax(240px,1fr)_170px_200px_160px_180px]">
          <label className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Nome, telefone, protocolo…"
              className="w-full rounded-xl border border-psi-soft bg-white py-2.5 pl-9 pr-3 text-xs text-ink placeholder:text-muted focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/20 font-medium"
            />
          </label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as FilterStatus)}
            className="rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs text-ink focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/20 font-medium"
          >
            <option value="TODOS">Todos os status</option>
            {Object.entries(statusLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <select
            value={psychologist}
            onChange={(event) => setPsychologist(event.target.value)}
            className="rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs text-ink focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/20 font-medium"
          >
            <option value="TODOS">Todos os psicólogos</option>
            {psychologists.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
          </select>
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value)}
            className="rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs text-ink focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/20 font-medium"
          >
            <option value="TODAS">Modalidades</option>
            {modes.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select
            value={agreement}
            onChange={(event) => setAgreement(event.target.value)}
            className="rounded-xl border border-psi-soft bg-white px-3 py-2.5 text-xs text-ink focus:outline-none focus:border-psi-vibrant focus:ring-2 focus:ring-psi-vibrant/20 font-medium"
          >
            <option value="TODOS">Todos os convênios</option>
            {agreements.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-psi-soft/60 pt-3">
          <label className="flex items-center gap-2 text-xs font-bold text-ink">
            Entrada de
            <input
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => setFrom(event.target.value)}
              className="rounded-xl border border-psi-soft bg-white px-3 py-1.5 text-xs text-ink font-normal focus:outline-none focus:border-psi-vibrant"
            />
            até
            <input
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => setTo(event.target.value)}
              className="rounded-xl border border-psi-soft bg-white px-3 py-1.5 text-xs text-ink font-normal focus:outline-none focus:border-psi-vibrant"
            />
          </label>
          {(from || to) && (
            <button
              onClick={() => { setFrom(''); setTo(''); }}
              className="text-xs font-bold text-psi-deep hover:text-psi-darkest underline"
            >
              limpar período
            </button>
          )}

          <label className="ml-auto flex items-center gap-2 text-xs font-bold text-ink">
            <ArrowDownWideNarrow className="h-4 w-4 text-psi-vibrant" />
            Ordenar por
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-xl border border-psi-soft bg-white px-3 py-1.5 text-xs text-ink font-normal focus:outline-none focus:border-psi-vibrant"
            >
              {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => <option key={key} value={key}>{SORT_LABEL[key]}</option>)}
            </select>
          </label>

          <div className="flex gap-2">
            <Toggle active={slaOnly} onClick={() => setSlaOnly(!slaOnly)}>SLA estourado</Toggle>
            <Toggle active={unassignedOnly} onClick={() => setUnassignedOnly(!unassignedOnly)}>Sem alocação</Toggle>
          </div>
        </div>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Tabela de Registros com Design System Viver Mais */}
      <section className="overflow-hidden rounded-2xl border border-psi-soft/60 bg-surface shadow-card">
        <div className="border-b border-psi-soft/60 px-5 py-3 text-xs font-bold text-muted bg-psi-soft/20">
          {loading ? 'Carregando…' : `${filtered.length} de ${patients.length} registros`}
        </div>
        {!loading && filtered.length === 0 ? (
          <div className="p-16 text-center text-xs text-muted">
            Nenhum paciente corresponde aos filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-xs">
              <thead className="bg-psi-soft/30 text-[10px] font-black uppercase tracking-[0.14em] text-muted border-b border-psi-soft/60">
                <tr>
                  <th className="p-4">Paciente</th>
                  <th className="p-4">Demanda</th>
                  <th className="p-4">Responsável</th>
                  <th className="p-4">Espera</th>
                  <th className="p-4">Agenda</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-psi-soft/40">
                {filtered.map((patient) => (
                  <tr
                    key={patient.id}
                    onClick={() => setSelected(patient)}
                    className="cursor-pointer transition-colors hover:bg-psi-soft/30"
                  >
                    <td className="p-4">
                      <p className="font-black text-ink">{patient.nome}</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {patient.whatsapp || 'Sem contato'} · {patient.protocolo || 'cadastro direto'}
                      </p>
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-ink">
                        {patient.servicoNome ?? patient.servicoKey ?? 'Não informado'}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {patient.modalidade ?? 'Modalidade pendente'}
                        {agreementOf(patient) !== 'Sem convênio' && ` · ${agreementOf(patient)}`}
                      </p>
                    </td>
                    <td className="p-4 font-semibold text-ink">
                      {patient.psicologoNome ?? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 text-xs font-bold border border-amber-500/20">
                          Aguardando alocação
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <Wait patient={patient} />
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-ink">{patient.agenda.realizadas} realizadas</p>
                      <p className="mt-0.5 text-[11px] text-muted">
                        {patient.agenda.proximaEm
                          ? `Próxima ${new Date(patient.agenda.proximaEm).toLocaleDateString('pt-BR')}`
                          : 'Sem próxima sessão'}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className={`inline-block rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${statusClass[patient.status]}`}>
                        {statusLabel[patient.status]}
                      </span>
                      {/* O desfecho do reengajamento era o que a fila da página
                          de retenção mostrava. Sem ele aqui, uma saída revertida
                          ficaria indistinguível de uma saída definitiva. */}
                      {patient.desistencia?.reengajado && (
                        <span className="mt-1 block w-fit rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-800">
                          reengajado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <PatientManagementDrawer
        key={selected?.id ?? 'closed'}
        patient={selectedPatient}
        psychologists={psychologists}
        onClose={() => setSelected(null)}
        onReassign={reassign}
        onDropoutChange={load}
      />
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof UsersRound; tone: string }) {
  return (
    <div className="min-w-24 rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm shadow-inner">
      <Icon className={`h-4 w-4 ${tone}`} />
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="text-[9px] font-bold uppercase tracking-wider text-psi-soft/70">{label}</p>
    </div>
  );
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition-all ${
        active
          ? 'border-psi-darkest bg-psi-darkest text-white shadow-sm'
          : 'border-psi-soft bg-white text-muted hover:bg-psi-soft/40 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function Wait({ patient }: { patient: ManagedPatient }) {
  if (patient.slaStatus === 'SEM_ALOCACAO') {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 text-xs font-bold border border-rose-500/20">
        Sem alocação
      </span>
    );
  }
  if (!patient.horasEspera) {
    return <span className="text-muted font-medium">Concluída</span>;
  }
  return (
    <span className={patient.horasEspera >= 24 ? 'inline-flex items-center gap-1 font-black text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 text-xs' : 'font-bold text-ink text-xs'}>
      {patient.horasEspera}h {patient.horasEspera >= 24 && '· prioridade'}
    </span>
  );
}

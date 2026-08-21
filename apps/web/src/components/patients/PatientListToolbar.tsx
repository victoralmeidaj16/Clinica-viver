'use client';

import { CheckCircle2, Search, Users, X } from 'lucide-react';

interface Props {
  activePatients: number;
  completedSessions: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenNewPatientModal: () => void;
}

export function PatientListToolbar({
  activePatients,
  completedSessions,
  searchQuery,
  onSearchChange,
  onOpenNewPatientModal,
}: Props) {
  return (
    <>
      <div className="card flex flex-col items-start justify-between gap-4 bg-gradient-to-r from-primary via-primary-dark to-purple-900 p-6 text-white shadow-xl md:flex-row md:items-center">
        <div className="space-y-1">
          <span className="chip border-white/20 bg-white/10 text-xs text-white">Gestão de Atendimentos</span>
          <h2 className="text-xl font-black">Prontuários &amp; Lista de Pacientes</h2>
          <p className="max-w-xl text-xs text-white/80">Acompanhe o histórico de sessões e o plano terapêutico de cada paciente.</p>
        </div>
        <button onClick={onOpenNewPatientModal} className="btn-accent shrink-0 px-4 py-2.5 text-xs shadow-md">+ Cadastrar Novo Paciente</button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Pacientes Ativos</span><p className="text-3xl font-black text-slate-900">{activePatients}</p><p className="text-xs text-slate-500">Em acompanhamento frequente</p></div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600"><Users className="h-6 w-6" /></span>
        </div>
        <div className="flex items-center justify-between rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-1"><span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Sessões Realizadas</span><p className="text-3xl font-black text-psi-vibrant">{completedSessions}</p><p className="text-xs text-slate-500">Atendimentos concluídos</p></div>
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-psi-vibrant/20 bg-psi-vibrant/10 text-psi-vibrant"><CheckCircle2 className="h-6 w-6" /></span>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <Search className="ml-1 h-5 w-5 shrink-0 text-slate-400" />
        <input type="search" value={searchQuery} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar paciente por nome, telefone ou CPF..." className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400" />
        {searchQuery && <button type="button" onClick={() => onSearchChange('')} aria-label="Limpar busca" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><X className="h-4 w-4" /></button>}
      </div>
    </>
  );
}

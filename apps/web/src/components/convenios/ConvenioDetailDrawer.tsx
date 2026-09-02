'use client';

import { useState } from 'react';
import { Building2, CalendarCheck2, Mail, Pencil, ShieldCheck, UsersRound, X } from 'lucide-react';
import type { ConvenioDetailView } from './types';
import { FaturamentoPanel } from './FaturamentoPanel';

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
const date = (iso: string) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

export function ConvenioDetailDrawer({ detail, loading, onClose, onEdit, onRefresh }: {
  detail?: ConvenioDetailView; loading: boolean; onClose: () => void; onEdit: () => void;
  onRefresh: (period?: { inicio: string; fim: string }) => Promise<void>;
}) {
  const [tab, setTab] = useState<'pacientes' | 'sessoes'>('pacientes');
  return (
    <aside className="fixed inset-0 z-50 flex justify-end bg-psi-darkest/60 backdrop-blur-[2px]" onMouseDown={onClose}>
      <div className="h-full w-full max-w-3xl overflow-y-auto border-l border-white/10 bg-surface shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
        {loading || !detail ? <div className="flex h-full items-center justify-center text-sm font-bold text-muted">Carregando convênio…</div> : <>
          <header className="sticky top-0 z-20 overflow-hidden border-b border-white/10 bg-psi-darkest p-5 text-white shadow-lg sm:p-6">
            <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[30px] border-psi-vibrant/15" />
            <div className="relative flex items-start justify-between gap-3">
              <div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant"><Building2 className="h-4 w-4" /> Convênio empresarial</p><h2 className="mt-2 text-2xl font-black">{detail.convenio.nome}</h2><p className="mt-1 text-xs text-psi-soft/70">{detail.convenio.razaoSocial ?? 'Razão social pendente'} · {detail.convenio.cnpj ?? 'CNPJ pendente'}</p></div>
              <div className="flex gap-2"><button type="button" onClick={onEdit} className="rounded-full border border-white/15 bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Editar convênio"><Pencil className="h-4 w-4" /></button><button type="button" onClick={onClose} className="rounded-full border border-white/15 bg-white/10 p-2.5 text-white hover:bg-white/20" aria-label="Fechar"><X className="h-4 w-4" /></button></div>
            </div>
            <div className="relative mt-5 grid grid-cols-3 gap-2"><Metric icon={UsersRound} label="Pacientes" value={String(detail.convenio.pacientes)} /><Metric icon={CalendarCheck2} label="A faturar" value={String(detail.convenio.sessoesProvisionadas)} /><Metric icon={ShieldCheck} label="Provisionado" value={money(detail.convenio.valorProvisionadoCents)} /></div>
          </header>
          <div className="space-y-5 p-4 sm:p-6">
            <section className={`rounded-2xl border p-4 ${detail.convenio.empresaPagaSessoes ? 'border-emerald-200 bg-emerald-50' : 'border-psi-soft bg-psi-soft/25'}`}>
              <p className="text-sm font-black text-ink">{detail.convenio.empresaPagaSessoes ? 'Empresa paga as sessões' : 'Paciente paga por padrão'}</p>
              <p className="mt-1 text-xs text-muted">A administração pode definir uma exceção individual no cadastro do paciente.</p>
              {detail.convenio.emailFaturamento && <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-ink"><Mail className="h-3.5 w-3.5" /> {detail.convenio.emailFaturamento}</p>}
            </section>
            <div className="flex rounded-xl bg-psi-soft/50 p-1">{(['pacientes', 'sessoes'] as const).map((item) => <button key={item} type="button" onClick={() => setTab(item)} className={`flex-1 rounded-lg px-3 py-2 text-xs font-black capitalize transition ${tab === item ? 'bg-white text-psi-deep shadow-sm' : 'text-muted'}`}>{item}</button>)}</div>
            {tab === 'pacientes' ? <div className="overflow-hidden rounded-2xl border border-psi-soft"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-[9px] font-black uppercase tracking-wider text-muted"><tr><th className="px-4 py-3">Paciente</th><th className="px-4 py-3">Psicólogo</th><th className="px-4 py-3 text-right">Sessões</th></tr></thead><tbody className="divide-y divide-psi-soft/60">{detail.pacientes.map((item) => <tr key={item.id}><td className="px-4 py-3"><p className="font-black text-ink">{item.nome}</p><p className={`text-[10px] font-bold ${item.custeadoPelaEmpresa ? 'text-emerald-700' : 'text-muted'}`}>{item.custeadoPelaEmpresa ? 'Custeado pela empresa' : 'Pagamento individual'}</p></td><td className="px-4 py-3 text-muted">{item.psicologoNome ?? '-'}</td><td className="px-4 py-3 text-right font-black text-ink">{item.sessoesNoPeriodo}</td></tr>)}</tbody></table>{detail.pacientes.length === 0 && <p className="p-8 text-center text-xs text-muted">Nenhum paciente vinculado.</p>}</div> : <div className="space-y-2">{detail.sessoes.map((item) => <article key={item.chargeId} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border border-psi-soft bg-white p-4"><div><p className="text-sm font-black text-ink">{item.pacienteNome}</p><p className="text-[10px] text-muted">{date(item.realizadaEm)} · {item.psicologoNome}</p></div><div className="text-right"><p className="text-sm font-black text-psi-deep">{money(item.valorCents)}</p><span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase ${item.faturaId ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{item.faturaId ? 'Faturada' : 'A faturar'}</span></div></article>)}{detail.sessoes.length === 0 && <p className="p-8 text-center text-xs text-muted">Nenhum atendimento no período.</p>}</div>}
            {(detail.convenio.empresaPagaSessoes || detail.convenio.pacientesCusteados > 0) && <FaturamentoPanel detail={detail} onRefresh={onRefresh} />}
          </div>
        </>}
      </div>
    </aside>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof UsersRound; label: string; value: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/10 p-3"><Icon className="h-3.5 w-3.5 text-psi-vibrant" /><p className="mt-2 text-lg font-black">{value}</p><p className="text-[9px] font-bold uppercase tracking-wider text-psi-soft/60">{label}</p></div>;
}

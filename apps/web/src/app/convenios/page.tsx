'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, CircleDollarSign, Loader2, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import { ConvenioList } from '@/components/convenios/ConvenioList';
import { ConvenioDetailDrawer } from '@/components/convenios/ConvenioDetailDrawer';
import { ConvenioFormModal } from '@/components/convenios/ConvenioFormModal';
import type { ConvenioDetailView, ConvenioPayload, ConvenioView } from '@/components/convenios/types';

interface Overview {
  convenios: ConvenioView[];
  resumo: { total: number; ativos: number; custeados: number; pacientes: number; provisionadoCents: number };
}

const money = (cents: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

export default function ConveniosPage() {
  const [overview, setOverview] = useState<Overview>();
  const [selectedId, setSelectedId] = useState<string>();
  const [detail, setDetail] = useState<ConvenioDetailView>();
  const [search, setSearch] = useState('');
  const [fundedOnly, setFundedOnly] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ConvenioView>();
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try { setOverview(await applicationRequest<Overview>('/convenios')); setError(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os convênios.'); }
  }, []);

  const loadDetail = useCallback(async (id: string, period?: { inicio: string; fim: string }) => {
    setLoadingDetail(true);
    try {
      const query = period ? `?inicio=${period.inicio}&fim=${period.fim}` : '';
      setDetail(await applicationRequest<ConvenioDetailView>(`/convenios/${encodeURIComponent(id)}${query}`));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o convênio.'); }
    finally { setLoadingDetail(false); }
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pt-BR');
    return (overview?.convenios ?? []).filter((item) =>
      (!query || [item.nome, item.razaoSocial, item.cnpj].some((value) => value?.toLocaleLowerCase('pt-BR').includes(query)))
      && (!fundedOnly || item.empresaPagaSessoes || item.pacientesCusteados > 0)
    );
  }, [fundedOnly, overview?.convenios, search]);

  const select = (id: string) => { setSelectedId(id); setDetail(undefined); void loadDetail(id); };
  const close = () => { setSelectedId(undefined); setDetail(undefined); };
  const save = async (payload: ConvenioPayload) => {
    const path = editing ? `/convenios/${encodeURIComponent(editing.id)}` : '/convenios';
    await applicationRequest(path, { method: editing ? 'PATCH' : 'POST', headers: commandHeaders(), body: JSON.stringify(payload) });
    await load();
    if (editing) await loadDetail(editing.id);
  };

  return (
    <div className="mx-auto max-w-[1450px] space-y-5 pb-12">
      <header className="relative overflow-hidden rounded-[30px] bg-psi-darkest p-6 text-white shadow-contrast sm:p-8">
        <div className="absolute -right-20 -top-28 h-80 w-80 rounded-full border-[54px] border-psi-vibrant/10" />
        <div className="absolute bottom-0 left-0 h-1 w-2/3 bg-gradient-to-r from-psi-vibrant via-emerald-400 to-transparent" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.24em] text-psi-vibrant"><ShieldCheck className="h-4 w-4" /> Faturamento empresarial rastreável</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Convênios & empresas</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-psi-soft/75">Vínculo de pacientes, provisão por atendimento, boleto consolidado e NFS-e PJ no mesmo livro-caixa.</p></div>
          <button type="button" onClick={() => { setEditing(undefined); setFormOpen(true); }} className="btn-accent shrink-0 px-5 py-3 text-xs"><Plus className="h-4 w-4" /> Novo convênio</button>
        </div>
      </header>

      {error && <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-800">{error}</p>}
      {!overview ? <div className="flex justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-psi-vibrant" /></div> : <>
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi icon={Building2} label="Empresas ativas" value={String(overview.resumo.ativos)} detail={`${overview.resumo.total} cadastradas`} />
          <Kpi icon={UsersRound} label="Pacientes vinculados" value={String(overview.resumo.pacientes)} detail="vínculo real no cadastro" />
          <Kpi icon={ShieldCheck} label="Custeio empresarial" value={String(overview.resumo.custeados)} detail="empresas pagadoras" />
          <Kpi icon={CircleDollarSign} label="Provisionado" value={money(overview.resumo.provisionadoCents)} detail="sessões a faturar" accent />
        </section>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <ConvenioList items={visible} selectedId={selectedId} search={search} fundedOnly={fundedOnly} onSearch={setSearch} onFundedOnly={setFundedOnly} onSelect={select} />
          <aside className="hidden rounded-[26px] border border-psi-soft/70 bg-[linear-gradient(145deg,#fdfbfe,#f4eef7)] p-6 lg:block"><p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-deep">Fluxo de um clique</p><ol className="mt-6 space-y-5">{['Confirme que o atendimento ocorreu', 'Feche a fatura da competência', 'Gere o boleto para a empresa', 'Baixa automática realiza o crédito 70%', 'Emita a NFS-e PJ da fatura quitada'].map((step, index) => <li key={step} className="grid grid-cols-[32px_1fr] items-start gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-psi-darkest text-xs font-black text-white">{index + 1}</span><p className="pt-1 text-sm font-bold leading-snug text-ink">{step}</p></li>)}</ol></aside>
        </div>
      </>}

      {selectedId && <ConvenioDetailDrawer detail={detail} loading={loadingDetail} onClose={close} onEdit={() => { if (detail) { setEditing(detail.convenio); setFormOpen(true); } }} onRefresh={(period) => loadDetail(selectedId, period)} />}
      {formOpen && <ConvenioFormModal convenio={editing} onClose={() => setFormOpen(false)} onSave={save} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, detail, accent }: { icon: typeof Building2; label: string; value: string; detail: string; accent?: boolean }) {
  return <article className={`rounded-2xl border p-5 shadow-card ${accent ? 'border-emerald-200 bg-emerald-50' : 'border-psi-soft/70 bg-surface'}`}><div className="flex items-center justify-between"><p className="text-[10px] font-black uppercase tracking-wider text-muted">{label}</p><Icon className={`h-4 w-4 ${accent ? 'text-emerald-700' : 'text-psi-vibrant'}`} /></div><p className="mt-3 text-2xl font-black text-ink">{value}</p><p className="mt-1 text-[10px] font-semibold text-muted">{detail}</p></article>;
}

'use client';

import { useState } from 'react';
import { Building2, Loader2, X } from 'lucide-react';
import type { ConvenioPayload, ConvenioView } from './types';

export function ConvenioFormModal({ convenio, onClose, onSave }: { convenio?: ConvenioView; onClose: () => void; onSave: (payload: ConvenioPayload) => Promise<void> }) {
  const [form, setForm] = useState<ConvenioPayload>({
    nome: convenio?.nome ?? '', razaoSocial: convenio?.razaoSocial ?? '', cnpj: convenio?.cnpj ?? '',
    emailFaturamento: convenio?.emailFaturamento ?? '', empresaPagaSessoes: convenio?.empresaPagaSessoes ?? false,
    pacoteSessoes: convenio?.pacoteSessoes, diaVencimento: convenio?.diaVencimento, ativo: convenio?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError('');
    try { await onSave(form); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível salvar.'); }
    finally { setSaving(false); }
  };
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-psi-darkest/70 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <form onSubmit={submit} onMouseDown={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[28px] border border-white/15 bg-surface shadow-2xl">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-psi-soft bg-surface/95 p-5 backdrop-blur">
          <div className="flex items-center gap-3"><span className="rounded-xl bg-psi-soft p-2 text-psi-deep"><Building2 className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-ink">{convenio ? 'Editar convênio' : 'Novo convênio'}</h2><p className="text-xs text-muted">Cadastro empresarial e política de custeio</p></div></div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted hover:bg-psi-soft"><X className="h-5 w-5" /></button>
        </header>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Nome de exibição" required><input required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="input text-xs" /></Field>
          <Field label="Razão social"><input value={form.razaoSocial} onChange={(e) => setForm({ ...form, razaoSocial: e.target.value })} className="input text-xs" /></Field>
          <Field label="CNPJ"><input inputMode="numeric" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} placeholder="00.000.000/0000-00" className="input text-xs" /></Field>
          <Field label="E-mail de faturamento"><input type="email" value={form.emailFaturamento} onChange={(e) => setForm({ ...form, emailFaturamento: e.target.value })} className="input text-xs" /></Field>
          <Field label="Pacote de sessões"><input type="number" min={1} value={form.pacoteSessoes ?? ''} onChange={(e) => setForm({ ...form, pacoteSessoes: e.target.value ? Number(e.target.value) : undefined })} className="input text-xs" /></Field>
          <Field label="Dia de vencimento (1 a 28)"><input type="number" min={1} max={28} value={form.diaVencimento ?? ''} onChange={(e) => setForm({ ...form, diaVencimento: e.target.value ? Number(e.target.value) : undefined })} className="input text-xs" /></Field>
          <label className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:col-span-2"><input type="checkbox" checked={form.empresaPagaSessoes} onChange={(e) => setForm({ ...form, empresaPagaSessoes: e.target.checked })} className="h-4 w-4 accent-emerald-700" /><span><span className="block text-sm font-black text-emerald-900">Empresa paga as sessões</span><span className="text-xs text-emerald-800/75">Pacientes vinculados herdam esta regra, salvo exceção administrativa.</span></span></label>
          <label className="flex items-center gap-3 text-xs font-bold text-ink"><input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="h-4 w-4 accent-psi-deep" /> Convênio ativo na vitrine</label>
          {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700 sm:col-span-2">{error}</p>}
        </div>
        <footer className="flex justify-end gap-2 border-t border-psi-soft p-5"><button type="button" onClick={onClose} className="btn-outline text-xs">Cancelar</button><button type="submit" disabled={saving} className="btn-accent text-xs disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}{saving ? 'Salvando…' : 'Salvar convênio'}</button></footer>
      </form>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return <label className="text-xs font-bold text-ink">{label}{required && <span className="text-rose-500"> *</span>}<span className="mt-1 block">{children}</span></label>;
}

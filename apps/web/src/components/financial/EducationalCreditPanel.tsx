'use client';

import { useEffect, useState } from 'react';
import type { ApuracaoCredito } from '@/server/reports/educationalCreditReport';
import { applicationRequest } from '@/lib/applicationApi';
import { dataHoraSessao } from '@/lib/sessionReference';
import { CAMPO, CARTAO, LINK, ROTULO, TITULO_CARTAO } from '@/components/ui/estilosFormulario';

const money = (n: number) => (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function mesAnterior() {
  const hoje = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', timeZone: 'America/Sao_Paulo' }).formatToParts(new Date());
  const ano = Number(hoje.find(p => p.type === 'year')?.value);
  const mes = Number(hoje.find(p => p.type === 'month')?.value);
  return new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 7);
}

export function EducationalCreditPanel({ admin }: { admin: boolean }) {
  const [mes, setMes] = useState(mesAnterior);
  const [relatorio, setRelatorio] = useState<ApuracaoCredito>();
  const [prof, setProf] = useState('');
  const [versao, atualizar] = useState(0);
  const [erro, setErro] = useState('');
  const base = '/financial/creditos/relatorio?mes=' + encodeURIComponent(mes);
  useEffect(() => {
    const controller = new AbortController();
    applicationRequest<ApuracaoCredito>(base, { signal: controller.signal })
      .then(result => { if (!controller.signal.aborted) { setRelatorio(result); setErro(''); } })
      .catch(() => { if (!controller.signal.aborted) setErro('Falha ao carregar a apuração.'); });
    return () => controller.abort();
  }, [base, versao]);
  const atual = relatorio?.mes === mes ? relatorio : undefined;
  const profissionais = new Map(atual?.linhas.map(l => [l.professionalId, l.profissional]));
  const linhas = atual?.linhas.filter(l => !prof || l.professionalId === prof) ?? [];
  const download = '/api/application' + base + '&profissional=' + encodeURIComponent(prof);
  return <section className={CARTAO}>
    <h2 className={TITULO_CARTAO}>Apuração de créditos educacionais</h2>
    <div className="flex flex-wrap items-end gap-4">
      <label className={ROTULO}>Competência <input className={CAMPO} type="month" value={mes} onChange={e => { setMes(e.target.value); setProf(''); }} /></label>
      <label className={ROTULO}>Profissional <select className={CAMPO} value={prof} onChange={e => setProf(e.target.value)}>
        <option value="">Todos</option>
        {[...profissionais].map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
      </select></label>
      {atual && <><a className="btn-outline px-4 py-2.5 text-[13px]" href={download + '&formato=xlsx'}>Baixar Excel</a>
        <a className="btn-outline px-4 py-2.5 text-[13px]" href={download + '&formato=pdf'}>Baixar PDF</a></>}
    </div>
    {erro && <p role="alert" className="text-xs font-semibold text-rose-700">{erro}</p>}
    {atual && <><p className="text-[13px] text-muted">Total de créditos: <strong className="font-black text-ink">{money(linhas.reduce((n, l) => n + l.creditCents, 0))}</strong></p>
      {linhas.length === 0 && <p className="text-[13px] text-muted">Nenhum lançamento nesta competência.</p>}
      {linhas.map(l => <article className="space-y-1 border-t border-line pt-3 text-xs text-muted" key={l.id}>
        <strong className="text-[13px] font-extrabold text-ink">{l.profissional} · {money(l.creditCents)}</strong>
        <p>{l.origem} · {dataHoraSessao(l.occurredAt)} · Base {money(l.baseCents)}</p>
        <small>{l.chargeId}</small>{l.receiptRef && <p>Referência do recebimento · {l.receiptRef}</p>}{l.receiptUrl && <a className={LINK} href={l.receiptUrl} target="_blank" rel="noreferrer">Abrir comprovante</a>}{l.justification && <p>{l.eventRef} · {l.justification} · {l.authorId} · Crédito original {l.originalId}</p>}
        {admin && !!l.refundRefs?.length && l.source !== 'adjustment' && <DecisaoCredito eventos={l.refundRefs} id={l.id} onSaved={() => atualizar(v => v + 1)} />}
      </article>)}</>}
  </section>;
}

function DecisaoCredito({ id, eventos, onSaved }: { id: string; eventos: string[]; onSaved: () => void }) {
  const [erro, setErro] = useState('');
  const [chave, setChave] = useState('');
  const [busy, setBusy] = useState(false);
  return <details onToggle={e => { if (e.currentTarget.open && !chave) setChave(crypto.randomUUID()); }}>
    <summary className="cursor-pointer text-xs font-bold text-psi-deep">Registrar decisão da Gestão</summary>
    <form className="mt-2 grid max-w-md gap-3" onSubmit={async e => {
      e.preventDefault();
      if (busy) return;
      const form = e.currentTarget;
      const dados = new FormData(form);
      setBusy(true);
      try {
        await applicationRequest('/gestao/creditos/' + encodeURIComponent(id) + '/ajustes', {
          method: 'POST', headers: { 'Idempotency-Key': chave }, body: JSON.stringify({
            evento: dados.get('evento'), justificativa: dados.get('motivo'),
            ajusteCentavos: Math.round(Number(dados.get('delta')) * 100),
          }),
        });
        form.reset(); setChave(crypto.randomUUID()); setErro('Decisão registrada.'); onSaved();
      } catch (error) { setErro(error instanceof Error ? error.message : 'Falha ao registrar decisão.'); }
      finally { setBusy(false); }
    }}>
      <label className={ROTULO}>Estorno, reembolso ou contestação <select className={CAMPO} required name="evento">{eventos.map(ref => <option key={ref}>{ref}</option>)}</select></label>
      <label className={ROTULO}>Ajuste em reais (zero para manter) <input className={CAMPO} required type="number" name="delta" step="0.01" /></label>
      <label className={ROTULO}>Justificativa <textarea className={CAMPO} required name="motivo" maxLength={500} /></label>
      <button className="btn-primary justify-self-start px-4 py-2.5 text-[13px]" disabled={busy || !chave}>Registrar decisão</button>
      {erro && <span role="status">{erro}</span>}
    </form>
  </details>;
}

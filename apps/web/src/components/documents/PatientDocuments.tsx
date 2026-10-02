'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Download, Eye, FileCheck2, Loader2, Plus } from 'lucide-react';
import { documentDate, PSYCHOLOGICAL_DOCUMENT_LABELS, type IssuedPsychologicalDocument, type PsychologicalDocumentContent, type PsychologicalDocumentInput } from '@thats-life/core';
import { applicationRequest } from '@/lib/applicationApi';
import { DocumentFields, type DocumentOptions } from './DocumentFields';
import { DocumentPreview } from './DocumentPreview';

type HistoryItem = Pick<IssuedPsychologicalDocument, 'id' | 'issuedAt'> & { kind: PsychologicalDocumentInput['kind'] };
type Preview = { content: PsychologicalDocumentContent; previewHash: string };
const initial: PsychologicalDocumentInput = { kind: 'attendance', purpose: 'Comprovação de comparecimento', location: '' };
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold disabled:opacity-50';

export function PatientDocuments({ patientId, appointmentId }: { patientId: string; appointmentId?: string }) {
  const base = `/patients/${encodeURIComponent(patientId)}/documents`;
  const [options, setOptions] = useState<DocumentOptions>();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [input, setInput] = useState<PsychologicalDocumentInput>({ ...initial, appointmentId });
  const [preview, setPreview] = useState<Preview>();
  const [issued, setIssued] = useState<IssuedPsychologicalDocument>();
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [emissionKey, setEmissionKey] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const today = documentDate(new Date().toISOString());

  useEffect(() => {
    let active = true;
    applicationRequest<DocumentOptions>(`${base}?view=options`).then((data) => {
      if (active) setOptions(data);
    }).catch((err: Error) => { if (active) setError(err.message); });
    applicationRequest<HistoryItem[]>(base).then((data) => {
      if (active) setHistory(data);
    }).catch((err: Error) => { if (active) setHistoryError(err.message); });
    return () => { active = false; };
  }, [base, loadVersion]);

  function change(value: PsychologicalDocumentInput) {
    setInput(value); setPreview(undefined); setIssued(undefined); setReviewed(false); setEmissionKey(''); setError('');
  }

  async function prepare(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setPreview(undefined); setReviewed(false);
    try {
      setPreview(await applicationRequest<Preview>(base, { method: 'POST', body: JSON.stringify({ ...input, action: 'preview' }) }));
      setEmissionKey(crypto.randomUUID());
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível gerar a prévia.'); }
    finally { setBusy(false); }
  }

  async function issue() {
    if (!preview || !reviewed || busy) return;
    setBusy(true); setError('');
    try {
      const document = await applicationRequest<IssuedPsychologicalDocument>(base, {
        method: 'POST', headers: { 'Idempotency-Key': emissionKey },
        body: JSON.stringify({ ...input, action: 'issue', reviewed, previewHash: preview.previewHash }),
      });
      setIssued(document); setPreview(undefined); setHistoryError('');
      setHistory((items) => [{ id: document.id, issuedAt: document.issuedAt, kind: document.content.kind }, ...items.filter((item) => item.id !== document.id)]);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível emitir o documento.'); }
    finally { setBusy(false); }
  }

  async function open(id: string) {
    setBusy(true); setError('');
    try {
      setIssued(await applicationRequest<IssuedPsychologicalDocument>(`${base}/${id}`));
      setPreview(undefined); setReviewed(false);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível abrir o documento.'); }
    finally { setBusy(false); }
  }

  async function download() {
    if (!issued) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/application${base}/${issued.id}?format=pdf`, { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível baixar o PDF. Tente novamente.');
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `documento-${issued.id.slice(0, 12)}.pdf`; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Falha no download.'); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <Link href="/pacientes" className="inline-flex items-center gap-2 text-sm text-muted"><ArrowLeft size={16} />Pacientes</Link>
    <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
      <div><h1 className="text-2xl font-bold">Documentos</h1><p className="mt-1 text-sm text-muted">{options?.patientName || 'Paciente'}</p></div>
      {issued && <button className={buttonClass} disabled={busy} onClick={() => change({ ...initial })}><Plus size={16} />Novo documento</button>}
    </header>
    {error && <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}
      {!options && <button className="ml-3 underline" onClick={() => { setError(''); setHistoryError(''); setLoadVersion((value) => value + 1); }}>Tentar novamente</button>}
    </div>}
    {!options && !error && <p role="status" className="flex items-center gap-2 text-sm"><Loader2 className="animate-spin" size={16} />Carregando documentos...</p>}
    {options && <div className="grid min-w-0 gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-7">
        {!issued && <form onSubmit={prepare}>
          <fieldset disabled={busy} className="min-w-0 space-y-5">
            <DocumentFields value={input} onChange={change} options={options} today={today} />
            <button className={`${buttonClass} w-full`} type="submit"><Eye size={16} />{busy ? 'Aguarde...' : 'Revisar documento'}</button>
          </fieldset>
        </form>}
        <section className="border-t border-line pt-5">
          <h2 className="text-sm font-bold">Histórico de emissões</h2>
          {historyError && <p role="alert" className="mt-3 text-sm text-amber-800">{historyError}</p>}
          {!historyError && history.length === 0 && <p className="mt-3 text-sm text-muted">Nenhum documento emitido.</p>}
          <ul className="mt-3 divide-y divide-gray-200">
            {history.map((item) => <li key={item.id}>
              <button disabled={busy} onClick={() => void open(item.id)} className="w-full py-3 text-left text-sm hover:text-emerald-700 disabled:opacity-50">
                <span className="block font-medium">{PSYCHOLOGICAL_DOCUMENT_LABELS[item.kind]}</span>
                <span className="text-xs text-muted">{new Date(item.issuedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</span>
              </button>
            </li>)}
          </ul>
        </section>
      </aside>
      <div className="min-w-0 space-y-4">
        {(preview || issued) ? <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold">{issued ? 'Documento emitido' : 'Prévia para revisão'}</h2>
            {issued && <button disabled={busy} onClick={() => void download()} className={buttonClass}><Download size={16} />Baixar PDF</button>}
          </div>
          <DocumentPreview content={(issued?.content ?? preview!.content)} />
          {preview && <div className="space-y-4 border-t border-line pt-4">
            <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-emerald-700" checked={reviewed} disabled={busy} onChange={(e) => setReviewed(e.target.checked)} />Revisei o conteúdo e confirmo as informações deste documento.</label>
            <button disabled={!reviewed || busy} onClick={() => void issue()} className={`${buttonClass} bg-emerald-700 text-white`}><FileCheck2 size={16} />{busy ? 'Emitindo...' : 'Emitir documento'}</button>
          </div>}
        </> : <div className="flex min-h-64 items-center justify-center border border-dashed border-gray-300 text-sm text-muted">Prévia do documento</div>}
      </div>
    </div>}
  </div>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { applicationRequest } from '@/lib/applicationApi';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';
import { reaisDeCentavos } from '@/lib/modalidadesPagamento';

interface Pacotes {
  pacientes: { id: string; nome: string }[];
  pacotes: { id: string; paciente_ref: string; quantidade: number; utilizadas: number;
    pago_em: string | null; valor_centavos: number; divergente: number }[];
}

export function PatientPackagePanel() {
  const [dados, setDados] = useState<Pacotes>();
  const [versao, atualizar] = useState(0);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [link, setLink] = useState<{ id: string; url: string }>();
  const tentativa = useRef<{ corpo: string; chave: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    applicationRequest<Pacotes>('/gestao/pacotes', { signal: controller.signal })
      .then(setDados).catch(() => { if (!controller.signal.aborted) setErro('Falha ao consultar pacotes.'); });
    return () => controller.abort();
  }, [versao]);
  async function criar(form: HTMLFormElement) {
    const campos = new FormData(form);
    const corpo = JSON.stringify({ action: 'criar', pacienteId: campos.get('paciente'), quantidade: Number(campos.get('quantidade')),
      valorCentavos: Math.round(Number(campos.get('total')) * 100), venceEm: clinicDateTimeToIso(String(campos.get('data')), '23:59') });
    if (tentativa.current?.corpo !== corpo) tentativa.current = { corpo, chave: crypto.randomUUID() };
    await applicationRequest('/gestao/pacotes', { method: 'POST', headers: { 'Idempotency-Key': tentativa.current.chave }, body: corpo });
    tentativa.current = null;
    form.reset();
    atualizar(n => n + 1);
  }
  async function emitir(id: string) {
    const result = await applicationRequest<{ url: string }>('/gestao/pacotes', {
      method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: JSON.stringify({ action: 'emitir', id }),
    });
    setLink({ id, url: result.url });
  }
  async function executar(acao: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true); setErro('');
    try { await acao(); } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao processar o pacote.'); }
    finally { setOcupado(false); }
  }
  return <section className="rounded-2xl border border-line bg-surface p-5 space-y-3">
    <h2 className="font-bold">Pacotes antecipados</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={e => {
      e.preventDefault(); const form = e.currentTarget; void executar(() => criar(form));
    }}>
      <label>Paciente <select required name="paciente" defaultValue=""><option disabled value="">Selecione</option>
        {dados?.pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label>Sessões <input className="w-20" required name="quantidade" type="number" min="1" max="65535" /></label>
      <label>Total em reais <input required name="total" type="number" step="0.01" min="0.01" /></label>
      <label>Vencimento <input required name="data" type="date" /></label>
      <button className="btn-outline" disabled={ocupado || !dados}>Criar pacote</button>
    </form>
    {erro && <p role="alert">{erro}</p>}
    {dados?.pacotes.map(k => <article key={k.id} className="border-t border-line py-2">
      <strong>{dados.pacientes.find(p => p.id === k.paciente_ref)?.nome ?? k.paciente_ref} · {reaisDeCentavos(Number(k.valor_centavos))}</strong>
      <p>{k.quantidade} contratadas · {k.utilizadas} utilizadas · {k.pago_em ? k.quantidade - k.utilizadas : 0} disponíveis</p>
      {k.divergente ? <span>Recebimento em conciliação</span> : k.pago_em ? <span>Pagamento confirmado</span> :
        link?.id === k.id ? <a className="underline" href={link.url} target="_blank" rel="noreferrer">Abrir cobrança integral</a> :
        <button className="underline" disabled={ocupado} onClick={() => void executar(() => emitir(k.id))}>Obter link de pagamento integral</button>}
    </article>)}
  </section>;
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { applicationRequest } from '@/lib/applicationApi';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';
import { reaisDeCentavos } from '@/lib/modalidadesPagamento';
import { CAMPO, CARTAO, LINK, ROTULO, TITULO_CARTAO } from '@/components/ui/estilosFormulario';

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
  return <section className={CARTAO}>
    <h2 className={TITULO_CARTAO}>Pacotes antecipados</h2>
    <form className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]" onSubmit={e => {
      e.preventDefault(); const form = e.currentTarget; void executar(() => criar(form));
    }}>
      <label className={ROTULO}>Paciente <select className={CAMPO} required name="paciente" defaultValue=""><option disabled value="">Selecione</option>
        {dados?.pacientes.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}</select></label>
      <label className={ROTULO}>Sessões <input className={CAMPO} required name="quantidade" type="number" min="1" max="65535" /></label>
      <label className={ROTULO}>Total em reais <input className={CAMPO} required name="total" type="number" step="0.01" min="0.01" /></label>
      <label className={ROTULO}>Vencimento <input className={CAMPO} required name="data" type="date" /></label>
      <button className="btn-primary px-4 py-2.5 text-[13px]" disabled={ocupado || !dados}>Criar pacote</button>
    </form>
    {erro && <p role="alert" className="text-xs font-semibold text-rose-700">{erro}</p>}
    {dados?.pacotes.map(k => <article key={k.id} className="space-y-1 border-t border-line pt-3 text-[13px]">
      <strong className="font-extrabold text-ink">{dados.pacientes.find(p => p.id === k.paciente_ref)?.nome ?? k.paciente_ref} · {reaisDeCentavos(Number(k.valor_centavos))}</strong>
      <p className="text-xs text-muted">{k.quantidade} contratadas · {k.utilizadas} utilizadas · {k.pago_em ? k.quantidade - k.utilizadas : 0} disponíveis</p>
      {k.divergente ? <span>Recebimento em conciliação</span> : k.pago_em ? <span>Pagamento confirmado</span> :
        link?.id === k.id ? <a className={LINK} href={link.url} target="_blank" rel="noreferrer">Abrir cobrança integral</a> :
        <button className={LINK} disabled={ocupado} onClick={() => void executar(() => emitir(k.id))}>Obter link de pagamento integral</button>}
    </article>)}
  </section>;
}

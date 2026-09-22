'use client';
import { useEffect, useState } from 'react';
import { CalendarDays, Loader2, Pencil, Search } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import { EditSessionModal, type SessionEditableData } from '@/components/scheduling/EditSessionModal';

type Appointment = SessionEditableData & { profissionalNome: string };
type Result = { appointments: Appointment[]; temMais: boolean };
const format = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });

export default function GestaoAgendaPage() {
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(0);
  const [resultado, setResultado] = useState<Result>();
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [edicao, setEdicao] = useState<Appointment>();
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setErro('');
      applicationRequest<Result>(`/gestao/agenda?${new URLSearchParams({ busca, pagina: String(pagina) })}`,
        { signal: controller.signal })
        .then((data) => { if (!controller.signal.aborted) setResultado(data); })
        .catch((error) => { if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : 'Não foi possível carregar a agenda.'); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [busca, pagina, versao]);

  return <main className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
    <header className="flex items-center gap-3">
      <div className="rounded-2xl bg-psi-vibrant/10 p-3 text-psi-deep"><CalendarDays className="h-6 w-6" /></div>
      <div><h1 className="text-2xl font-black text-ink">Agenda da Clínica</h1>
        <p className="text-sm text-muted">Gerencie os atendimentos agendados e confirmados de todos os profissionais.</p></div>
    </header>
    <section className="rounded-3xl border border-line bg-surface p-5">
      <label htmlFor="busca-agenda" className="mb-2 block text-xs font-bold text-ink">Buscar por paciente ou psicólogo</label>
      <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
        <input id="busca-agenda" type="search" value={busca} placeholder="Digite um nome"
          onChange={(event) => { setBusca(event.target.value); setPagina(0); }} className="input w-full pl-10" /></div>
    </section>
    <section className="overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="border-b border-line p-5"><h2 className="font-extrabold text-ink">Sessões e confirmações</h2>
        <p className="mt-1 text-xs text-muted">Edite horário, modalidade, responsável pelo pagamento e status.</p></div>
      {erro ? <div role="alert" className="space-y-3 p-6 text-sm text-rose-700"><p>{erro}</p>
        <button className="btn-outline" onClick={() => setVersao((value) => value + 1)}>Tentar novamente</button></div>
        : loading ? <div role="status" className="flex items-center gap-2 p-8 text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando sessões…</div>
        : !resultado?.appointments.length ? <p className="p-8 text-sm text-muted">Nenhuma sessão agendada ou confirmada encontrada.</p>
        : <ul className="divide-y divide-line">{resultado.appointments.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="space-y-1"><p className="font-extrabold text-ink">{item.pacienteNome}</p>
            <p className="text-xs text-muted">{format.format(new Date(item.inicio))} · {item.modalidade === 'presencial' ? 'Presencial' : item.modalidade === 'telefone' ? 'Telefone' : 'Online'}</p>
            <p className="text-xs text-muted">Psicólogo: {item.profissionalNome}</p>
            {item.convenioNome && <p className="text-xs font-semibold text-psi-deep">{item.convenioNome} · {item.custeadoPelaEmpresa ? 'Pago pela empresa' : 'Pago pelo paciente'}</p>}
          </div>
          <div className="flex items-center gap-3"><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-800">{item.status === 'confirmado' ? 'Confirmada' : 'Agendada'}</span>
            <button type="button" className="btn-outline gap-2 text-xs" onClick={() => setEdicao(item)} aria-label={`Editar sessão de ${item.pacienteNome}`}><Pencil className="h-3.5 w-3.5" />Editar</button></div>
        </li>)}</ul>}
      <div className="flex items-center justify-between border-t border-line p-4">
        <button className="btn-outline text-xs" disabled={pagina === 0 || loading} onClick={() => setPagina((value) => value - 1)}>Anterior</button>
        <span className="text-xs text-muted">Página {pagina + 1}</span>
        <button className="btn-outline text-xs" disabled={!resultado?.temMais || loading} onClick={() => setPagina((value) => value + 1)}>Próxima</button>
      </div>
    </section>
    <EditSessionModal admin session={edicao} isOpen={Boolean(edicao)} onClose={() => setEdicao(undefined)}
      onSaved={() => setVersao((value) => value + 1)} />
  </main>;
}

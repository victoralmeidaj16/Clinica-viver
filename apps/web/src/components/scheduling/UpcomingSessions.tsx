'use client';

import { useState } from 'react';
import {
  CalendarClock, CalendarDays, CheckCircle2, Copy, CreditCard, Globe, Loader2, MapPin, XCircle,
} from 'lucide-react';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';

export interface AgendamentoResumo {
  id: string;
  pacienteNome: string;
  inicio: string;
  fim: string;
  modalidade: 'presencial' | 'online' | 'telefone';
  status: string;
  origem: string;
  criadoEm: string;
  realizadoEm?: string;
  linkPagamento: string;
  pagamentoStatus?: string;
  vencimentoCobrancaEm?: string;
  custeadoPelaEmpresa: boolean;
  convenioNome?: string;
  podeConfirmarRealizacao: boolean;
}

interface Props {
  agendamentos: readonly AgendamentoResumo[];
  onCancelar: (id: string, motivo: string) => Promise<void>;
  onConfirmarRealizacao: (id: string) => Promise<void>;
  onAtualizarVencimento: (id: string, dueAt: string) => Promise<void>;
}

const FORMATO = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

export function UpcomingSessions({ agendamentos, onCancelar, onConfirmarRealizacao, onAtualizarVencimento }: Props) {
  const [cancelando, setCancelando] = useState<AgendamentoResumo>();
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string>();
  const [confirmandoId, setConfirmandoId] = useState<string>();
  const [copiadoId, setCopiadoId] = useState<string>();
  const [editandoVencimento, setEditandoVencimento] = useState<AgendamentoResumo>();
  const [vencimentoData, setVencimentoData] = useState('');
  const [vencimentoHora, setVencimentoHora] = useState('');
  const [salvandoVencimento, setSalvandoVencimento] = useState(false);

  const abrirVencimento = (item: AgendamentoResumo) => {
    const iso = item.vencimentoCobrancaEm ?? item.inicio;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((part) => [part.type, part.value]));
    setVencimentoData(`${parts.year}-${parts.month}-${parts.day}`);
    setVencimentoHora(`${parts.hour}:${parts.minute}`);
    setEditandoVencimento(item); setErro(undefined);
  };

  const salvarVencimento = async (event: React.FormEvent) => {
    event.preventDefault(); if (!editandoVencimento) return;
    setSalvandoVencimento(true); setErro(undefined);
    try {
      await onAtualizarVencimento(editandoVencimento.id, clinicDateTimeToIso(vencimentoData, vencimentoHora));
      setEditandoVencimento(undefined);
    } catch (cause) { setErro(cause instanceof Error ? cause.message : 'Não foi possível alterar o vencimento.'); }
    finally { setSalvandoVencimento(false); }
  };

  const confirmar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!cancelando || !motivo.trim()) { setErro('O motivo é obrigatório.'); return; }
    try {
      await onCancelar(cancelando.id, motivo);
      setCancelando(undefined); setMotivo(''); setErro(undefined);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível cancelar.');
    }
  };

  const confirmarRealizacao = async (item: AgendamentoResumo) => {
    setConfirmandoId(item.id);
    setErro(undefined);
    try {
      await onConfirmarRealizacao(item.id);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível confirmar a sessão.');
    } finally {
      setConfirmandoId(undefined);
    }
  };

  const copiarPagamento = async (item: AgendamentoResumo) => {
    const url = new URL(item.linkPagamento, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCopiadoId(item.id);
    window.setTimeout(() => setCopiadoId((atual) => atual === item.id ? undefined : atual), 2500);
  };

  return (
    <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
      <div className="p-6 border-b border-line">
        <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-psi-vibrant" /> Sessões e confirmações
        </h3>
        <p className="text-xs text-muted">
          Inclui o que os pacientes marcaram sozinhos pelo link, identificados pelo CPF.
        </p>
      </div>

      {erro && !cancelando && (
        <div role="alert" className="border-b border-rose-200 bg-rose-50 px-6 py-3 text-xs font-semibold text-rose-800">
          {erro}
        </div>
      )}

      {cancelando && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={confirmar} className="bg-surface rounded-3xl p-6 border border-line shadow-2xl max-w-md w-full space-y-4">
            <h2 className="text-lg font-black text-ink">Cancelar atendimento</h2>
            <p className="text-xs text-muted">
              Paciente: <span className="font-bold text-ink">{cancelando.pacienteNome}</span> — {FORMATO.format(new Date(cancelando.inicio))}
            </p>
            <label className="text-xs font-bold text-ink block">
              Motivo <span className="text-rose-500">* (obrigatório)</span>
              <textarea required rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Descreva a justificativa registrada no histórico." className="input mt-1 text-xs" />
            </label>
            {erro && <p className="text-[11px] font-bold text-rose-600">{erro}</p>}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setCancelando(undefined); setErro(undefined); }} className="btn-outline flex-1 text-xs">Voltar</button>
              <button type="submit" className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-extrabold py-3 text-xs">Confirmar cancelamento</button>
            </div>
          </form>
        </div>
      )}

      {editandoVencimento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form onSubmit={salvarVencimento} className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl">
            <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-amber-700">Cobrança da sessão</p><h2 className="text-lg font-black text-ink">Editar vencimento</h2><p className="mt-1 text-xs text-muted">{editandoVencimento.pacienteNome} · {FORMATO.format(new Date(editandoVencimento.inicio))}</p></div>
            <div className="grid grid-cols-2 gap-3"><label className="text-xs font-bold text-ink">Data *<input required type="date" value={vencimentoData} onChange={(e) => setVencimentoData(e.target.value)} className="input mt-1" /></label><label className="text-xs font-bold text-ink">Horário *<input required type="time" value={vencimentoHora} onChange={(e) => setVencimentoHora(e.target.value)} className="input mt-1" /></label></div>
            {erro && <p className="rounded-xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700">{erro}</p>}
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900">Se já existir um Pix pendente, ele será invalidado e recriado no próximo acesso.</p>
            <div className="flex gap-2"><button type="button" onClick={() => { setEditandoVencimento(undefined); setErro(undefined); }} className="btn-outline flex-1 justify-center">Voltar</button><button type="submit" disabled={salvandoVencimento} className="btn-primary flex-1 justify-center">{salvandoVencimento ? 'Salvando…' : 'Salvar'}</button></div>
          </form>
        </div>
      )}

      <ul className="divide-y divide-line">
        {agendamentos.map((item) => {
          const cancelado = item.status === 'cancelado';
          const realizado = item.status === 'realizado';
          return (
            <li key={item.id} className="space-y-3 px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-extrabold ${cancelado ? 'text-muted line-through' : 'text-ink'}`}>
                  {item.pacienteNome}
                </p>
                <p className="text-xs text-muted flex items-center gap-1.5">
                  {FORMATO.format(new Date(item.inicio))}
                  <span className="text-line">·</span>
                  {item.modalidade === 'presencial'
                    ? <><MapPin className="w-3 h-3" /> Presencial</>
                    : <><Globe className="w-3 h-3" /> Online</>}
                  {item.origem === 'portal' && <span className="chip-accent text-[10px] py-0">pelo link</span>}
                </p>
              </div>
              {cancelado ? <span className="text-[11px] font-extrabold text-rose-600">CANCELADA</span>
              : realizado ? (
                <span className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> REALIZADA
                </span>
              ) : (
                <button type="button" onClick={() => setCancelando(item)} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 flex items-center gap-1.5">
                  <XCircle className="w-3.5 h-3.5" /> Cancelar
                </button>
              )}
              </div>

              {!cancelado && (
                <div className="flex flex-wrap gap-2 rounded-2xl border border-line bg-slate-50/70 p-2.5">
                  {item.podeConfirmarRealizacao && (
                    <button
                      type="button"
                      disabled={confirmandoId === item.id}
                      onClick={() => void confirmarRealizacao(item)}
                      className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-extrabold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {confirmandoId === item.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      Confirmar que ocorreu
                    </button>
                  )}
                  {item.custeadoPelaEmpresa ? (
                    <span className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-extrabold text-emerald-800">
                      <CreditCard className="h-3.5 w-3.5" /> Custeado por {item.convenioNome ?? 'empresa'} - sem cobrança
                    </span>
                  ) : <>
                    <a href={item.linkPagamento} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-xl border border-psi-vibrant/25 bg-white px-3 py-2 text-[11px] font-extrabold text-psi-deep hover:bg-psi-soft/50">
                      <CreditCard className="h-3.5 w-3.5" /> Pagamento da sessão
                    </a>
                    <button type="button" onClick={() => void copiarPagamento(item)} className="flex items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-bold text-muted hover:text-ink">
                      <Copy className="h-3.5 w-3.5" /> {copiadoId === item.id ? 'Link copiado' : 'Copiar link'}
                    </button>
                  </>}
                  {!item.custeadoPelaEmpresa && item.pagamentoStatus && (
                    <span className="self-center text-[10px] font-bold uppercase tracking-wider text-muted">
                      Pagamento: {item.pagamentoStatus === 'paid' ? 'pago' : 'pendente'}
                    </span>
                  )}
                  {!item.custeadoPelaEmpresa && !['paid', 'partially_paid', 'refunded'].includes(item.pagamentoStatus ?? '') && (
                    <button type="button" onClick={() => abrirVencimento(item)} className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-900 hover:bg-amber-100"><CalendarClock className="h-3.5 w-3.5" /> Editar vencimento</button>
                  )}
                  {!item.custeadoPelaEmpresa && item.vencimentoCobrancaEm && <span className="self-center text-[10px] font-semibold text-muted">Vence {FORMATO.format(new Date(item.vencimentoCobrancaEm))}</span>}
                </div>
              )}
            </li>
          );
        })}
        {agendamentos.length === 0 && (
          <li className="px-6 py-10 text-center text-xs text-muted">
            Nenhuma sessão marcada. Compartilhe seu link de agendamento com os pacientes.
          </li>
        )}
      </ul>
    </div>
  );
}

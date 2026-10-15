'use client';

import { useMemo, useState } from 'react';
import { CalendarOff, Trash2 } from 'lucide-react';

export interface BloqueioAgenda {
  id: string;
  inicio: string;
  fim: string;
  motivo?: string;
}

export type NovoBloqueioAgenda =
  | { tipo: 'dia'; inicioDia: string; fimDia: string; motivo?: string }
  | { tipo: 'horario'; data: string; horaInicio: string; horaFim: string; motivo?: string };

interface Props {
  bloqueios: readonly BloqueioAgenda[];
  onAdicionar: (input: NovoBloqueioAgenda) => Promise<void>;
  onRemover: (id: string) => Promise<void>;
}

function rotuloPeriodo(bloqueio: BloqueioAgenda): string {
  const formato = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
  const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' });
  const inicio = formato.format(new Date(bloqueio.inicio));
  // O fim é gravado no primeiro instante do dia seguinte; exibi-lo cru mostraria
  // ao profissional um dia a mais do que ele bloqueou.
  const fim = formato.format(new Date(Date.parse(bloqueio.fim) - 1));
  const horaInicio = formatoHora.format(new Date(bloqueio.inicio));
  const horaFim = formatoHora.format(new Date(bloqueio.fim));
  const diaInteiro = horaInicio === '00:00' && horaFim === '00:00';
  if (!diaInteiro && inicio === fim) return `${inicio}, ${horaInicio} às ${horaFim}`;
  if (!diaInteiro) return `${inicio}, ${horaInicio} até ${fim}, ${horaFim}`;
  return inicio === fim ? inicio : `${inicio} a ${fim}`;
}

/**
 * Férias, feriados e folgas: o que a grade semanal não sabe sozinha.
 * Desenha só o conteúdo do passo de bloqueios; quem chama dá a moldura.
 */
export function AgendaBlocks({ bloqueios, onAdicionar, onRemover }: Props) {
  const [inicioDia, setInicioDia] = useState('');
  const [fimDia, setFimDia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);

  const fechar = () => {
    setAberto(false); setErro(undefined);
    setInicioDia(''); setFimDia(''); setMotivo('');
  };

  const totalDias = useMemo(() => {
    if (!inicioDia) return 0;
    const fim = fimDia || inicioDia;
    const tInicio = Date.parse(`${inicioDia}T12:00:00Z`);
    const tFim = Date.parse(`${fim}T12:00:00Z`);
    if (isNaN(tInicio) || isNaN(tFim) || tFim < tInicio) return 0;
    return Math.round((tFim - tInicio) / (24 * 60 * 60 * 1000)) + 1;
  }, [inicioDia, fimDia]);

  const precisaMotivo = totalDias > 5;

  const adicionar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setSalvando(true); setErro(undefined);
    try {
      await onAdicionar({
        tipo: 'dia',
        inicioDia,
        fimDia: fimDia || inicioDia,
        motivo: precisaMotivo && motivo.trim() ? motivo.trim() : undefined,
      });
      fechar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível bloquear o período.');
    } finally { setSalvando(false); }
  };

  return (
    <>
      {bloqueios.map((bloqueio) => (
        <div key={bloqueio.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-2.5">
          <div className="min-w-0">
            <strong className="block text-[13px] font-extrabold tabular-nums text-ink">{rotuloPeriodo(bloqueio)}</strong>
            <span className="text-[11.5px] text-muted">{bloqueio.motivo ?? 'Some do seu link de agendamento'}</span>
          </div>
          <button type="button" onClick={() => void onRemover(bloqueio.id)} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100">
            <Trash2 className="h-3.5 w-3.5" /> Remover
          </button>
        </div>
      ))}

      {aberto ? (
        <form onSubmit={adicionar} className="flex flex-col gap-3 rounded-2xl border border-dashed border-[#DCC8F0] bg-[#FDFBFF] p-3.5">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-[11px] font-extrabold text-muted">De
              <input required type="date" value={inicioDia} onChange={(e) => setInicioDia(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-ink" />
            </label>
            <label className="text-[11px] font-extrabold text-muted">Até
              <input type="date" value={fimDia} min={inicioDia} onChange={(e) => setFimDia(e.target.value)} className="mt-1 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-ink" />
            </label>
            {precisaMotivo && (
              <label className="min-w-[180px] flex-1 text-[11px] font-extrabold text-muted animate-in fade-in duration-150">
                Motivo do bloqueio ({totalDias} dias)
                <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Férias, congresso, licença…" className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-ink" />
              </label>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={fechar} className="btn-outline px-3 py-2 text-[11px]">Cancelar</button>
              <button type="submit" disabled={salvando} className="btn-primary px-3 py-2 text-[11px]">{salvando ? 'Bloqueando…' : 'Bloquear'}</button>
            </div>
          </div>
          <p className="text-[11px] leading-relaxed text-muted">
            Os dias somem do seu link sem apagar a grade semanal. No período, você também sai da fila de novos
            pacientes e a coordenação é avisada; seus pacientes atuais continuam vendo seu perfil normalmente.
          </p>
          {erro && <p role="alert" className="text-[11px] font-bold text-rose-700">{erro}</p>}
        </form>
      ) : (
        <button type="button" onClick={() => setAberto(true)} className="inline-flex items-center gap-2 self-start rounded-xl border border-[#DCC8F0] bg-white px-4 py-2.5 text-[12.5px] font-extrabold text-psi-darkest transition hover:bg-canvas">
          <CalendarOff className="h-4 w-4 text-psi-deep" /> Adicionar bloqueio
        </button>
      )}
    </>
  );
}

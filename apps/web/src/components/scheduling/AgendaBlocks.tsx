'use client';

import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';

export interface BloqueioAgenda {
  id: string;
  inicio: string;
  fim: string;
  motivo?: string;
}

export type NovoBloqueioAgenda =
  | { tipo: 'dia'; inicioDia: string; fimDia: string; motivo: string }
  | { tipo: 'horario'; data: string; horaInicio: string; horaFim: string; motivo: string };

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

/** Férias, feriados e folgas: o que a grade semanal não sabe sozinha. */
export function AgendaBlocks({ bloqueios, onAdicionar, onRemover }: Props) {
  const [inicioDia, setInicioDia] = useState('');
  const [fimDia, setFimDia] = useState('');
  const [motivo, setMotivo] = useState('');
  const [erro, setErro] = useState<string>();
  const [salvando, setSalvando] = useState(false);

  const adicionar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setSalvando(true); setErro(undefined);
    try {
      await onAdicionar({ tipo: 'dia', inicioDia, fimDia: fimDia || inicioDia, motivo });
      setInicioDia(''); setFimDia(''); setMotivo('');
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível bloquear o período.');
    } finally { setSalvando(false); }
  };

  return (
    <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
      <div className="p-6 border-b border-line">
        <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
          <CalendarOff className="w-4 h-4 text-psi-vibrant" /> Períodos bloqueados
        </h3>
        <p className="text-xs text-muted">
          Férias e folgas somem do link do paciente sem que você precise apagar a grade semanal.
          No período, você também sai da fila de novos pacientes e a coordenação é avisada —
          seus pacientes atuais continuam vendo seu perfil normalmente.
        </p>
      </div>

      <form onSubmit={adicionar} className="p-6 border-b border-line flex flex-wrap items-end gap-3">
        <label className="text-[11px] font-bold text-ink">De
          <input required type="date" value={inicioDia} onChange={(e) => setInicioDia(e.target.value)} className="input mt-1 py-2 text-xs" />
        </label>
        <label className="text-[11px] font-bold text-ink">Até
          <input type="date" value={fimDia} min={inicioDia} onChange={(e) => setFimDia(e.target.value)} className="input mt-1 py-2 text-xs" />
        </label>
        <label className="text-[11px] font-bold text-ink flex-1 min-w-[180px]">Motivo (opcional)
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Férias, congresso…" className="input mt-1 py-2 text-xs" />
        </label>
        <button type="submit" disabled={salvando} className="btn-primary text-xs">
          <Plus className="w-4 h-4" /> Bloquear
        </button>
      </form>

      {erro && <p className="px-6 py-3 text-xs font-bold bg-rose-50 text-rose-700">{erro}</p>}

      <ul className="divide-y divide-line">
        {bloqueios.map((bloqueio) => (
          <li key={bloqueio.id} className="px-6 py-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-extrabold text-ink">{rotuloPeriodo(bloqueio)}</p>
              {bloqueio.motivo && <p className="text-[11px] text-muted">{bloqueio.motivo}</p>}
            </div>
            <button type="button" onClick={() => void onRemover(bloqueio.id)} aria-label="Remover bloqueio" className="rounded-xl border border-line p-2 text-muted hover:text-rose-600 hover:border-rose-200">
              <Trash2 className="w-4 h-4" />
            </button>
          </li>
        ))}
        {bloqueios.length === 0 && (
          <li className="px-6 py-8 text-center text-xs text-muted">Nenhum período bloqueado.</li>
        )}
      </ul>
    </div>
  );
}

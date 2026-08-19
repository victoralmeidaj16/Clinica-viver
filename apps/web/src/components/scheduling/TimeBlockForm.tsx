'use client';

import { useState } from 'react';
import { CalendarX2, X } from 'lucide-react';
import type { NovoBloqueioAgenda } from './AgendaBlocks';

interface Props {
  data: string;
  horaInicio?: string;
  horaFim?: string;
  onAdicionar: (input: NovoBloqueioAgenda) => Promise<void>;
  onCancelar: () => void;
}

export function TimeBlockForm({ data, horaInicio = '13:00', horaFim = '13:50', onAdicionar, onCancelar }: Props) {
  const [inicio, setInicio] = useState(horaInicio);
  const [fim, setFim] = useState(horaFim);
  const [motivo, setMotivo] = useState('Compromisso externo');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();

  const confirmar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (fim <= inicio) {
      setErro('O horário final deve ser posterior ao inicial.');
      return;
    }
    try {
      setSalvando(true);
      setErro(undefined);
      await onAdicionar({ tipo: 'horario', data, horaInicio: inicio, horaFim: fim, motivo });
      onCancelar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível bloquear o horário.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={confirmar} className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-extrabold text-amber-950"><CalendarX2 className="h-4 w-4" /> Novo bloqueio pontual</p>
          <p className="mt-0.5 text-[11px] text-amber-800">Esse período deixará de aparecer no link dos pacientes.</p>
        </div>
        <button type="button" onClick={onCancelar} aria-label="Fechar formulário" className="rounded-lg p-1 text-amber-800 hover:bg-amber-100"><X className="h-4 w-4" /></button>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
        <label className="text-[11px] font-bold text-amber-950">Início
          <input required type="time" value={inicio} onChange={(evento) => setInicio(evento.target.value)} className="input mt-1 py-2 text-sm font-bold" />
        </label>
        <span className="pb-3 text-[11px] font-bold text-amber-800">até</span>
        <label className="text-[11px] font-bold text-amber-950">Fim
          <input required type="time" value={fim} onChange={(evento) => setFim(evento.target.value)} className="input mt-1 py-2 text-sm font-bold" />
        </label>
      </div>

      <label className="block text-[11px] font-bold text-amber-950">Motivo <span className="font-normal text-amber-700">(opcional)</span>
        <input value={motivo} onChange={(evento) => setMotivo(evento.target.value)} placeholder="Compromisso externo" className="input mt-1 py-2 text-sm" />
      </label>

      {erro && <p role="alert" className="text-[11px] font-bold text-rose-700">{erro}</p>}
      <button type="submit" disabled={salvando} className="w-full rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-amber-700 disabled:opacity-50">
        {salvando ? 'Bloqueando…' : `Bloquear ${inicio}–${fim}`}
      </button>
    </form>
  );
}

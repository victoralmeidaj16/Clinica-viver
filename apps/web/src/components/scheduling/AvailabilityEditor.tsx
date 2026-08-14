'use client';

import { useState } from 'react';
import { Clock, Plus, Save, Trash2 } from 'lucide-react';

export interface JanelaEditavel {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  duracaoMin: number;
  modalidade: 'presencial' | 'online';
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const NOVA_JANELA: JanelaEditavel = {
  diaSemana: 1,
  horaInicio: '08:00',
  horaFim: '12:00',
  duracaoMin: 50,
  modalidade: 'online',
};

interface Props {
  janelas: readonly JanelaEditavel[];
  onSalvar: (janelas: JanelaEditavel[]) => Promise<void>;
}

/**
 * Quadro semanal de atendimento.
 *
 * O rascunho é local e só vira grade publicada no "Salvar": o profissional
 * mexe em várias linhas de uma vez, e gravar a cada tecla exporia ao paciente
 * um estado intermediário — uma janela pela metade, uma sobreposição que ele
 * ainda ia corrigir.
 */
export function AvailabilityEditor({ janelas, onSalvar }: Props) {
  const [rascunho, setRascunho] = useState<JanelaEditavel[]>([...janelas]);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();

  const alterar = (indice: number, campo: Partial<JanelaEditavel>) =>
    setRascunho((atual) => atual.map((item, i) => (i === indice ? { ...item, ...campo } : item)));

  const salvar = async () => {
    setSalvando(true); setAviso(undefined);
    try {
      await onSalvar(rascunho);
      setAviso({ tipo: 'ok', texto: 'Grade publicada. O link do paciente já mostra os novos horários.' });
    } catch (causa) {
      setAviso({ tipo: 'erro', texto: causa instanceof Error ? causa.message : 'Não foi possível salvar.' });
    } finally { setSalvando(false); }
  };

  return (
    <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
      <div className="p-6 border-b border-line flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
            <Clock className="w-4 h-4 text-psi-vibrant" /> Horários que você atende
          </h3>
          <p className="text-xs text-muted">
            Cada janela vira botões de horário na tela do paciente, do tamanho da duração escolhida.
          </p>
        </div>
        <button type="button" onClick={() => void salvar()} disabled={salvando} className="btn-primary text-xs">
          <Save className="w-4 h-4" /> {salvando ? 'Salvando…' : 'Salvar grade'}
        </button>
      </div>

      {aviso && (
        <p className={`px-6 py-3 text-xs font-bold ${
          aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
        }`}>{aviso.texto}</p>
      )}

      <div className="p-6 space-y-3">
        {rascunho.length === 0 && (
          <p className="text-xs text-muted py-6 text-center">
            Nenhuma janela cadastrada. Sem elas, o link de agendamento não oferece horário nenhum.
          </p>
        )}

        {rascunho.map((janela, indice) => (
          <div key={indice} className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-canvas/60 p-4">
            <label className="text-[11px] font-bold text-ink">Dia
              <select value={janela.diaSemana} onChange={(e) => alterar(indice, { diaSemana: Number(e.target.value) })} className="input mt-1 py-2 text-xs">
                {DIAS.map((dia, numero) => <option key={dia} value={numero}>{dia}</option>)}
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink">Das
              <input type="time" value={janela.horaInicio} onChange={(e) => alterar(indice, { horaInicio: e.target.value })} className="input mt-1 py-2 text-xs" />
            </label>
            <label className="text-[11px] font-bold text-ink">Até
              <input type="time" value={janela.horaFim} onChange={(e) => alterar(indice, { horaFim: e.target.value })} className="input mt-1 py-2 text-xs" />
            </label>
            <label className="text-[11px] font-bold text-ink">Duração
              <select value={janela.duracaoMin} onChange={(e) => alterar(indice, { duracaoMin: Number(e.target.value) })} className="input mt-1 py-2 text-xs">
                {[30, 45, 50, 60, 90].map((minutos) => <option key={minutos} value={minutos}>{minutos} min</option>)}
              </select>
            </label>
            <label className="text-[11px] font-bold text-ink">Modalidade
              <select value={janela.modalidade} onChange={(e) => alterar(indice, { modalidade: e.target.value as 'presencial' | 'online' })} className="input mt-1 py-2 text-xs">
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
              </select>
            </label>
            <button type="button" onClick={() => setRascunho((atual) => atual.filter((_, i) => i !== indice))} aria-label="Remover janela" className="ml-auto rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button type="button" onClick={() => setRascunho((atual) => [...atual, NOVA_JANELA])} className="btn-outline text-xs w-full justify-center">
          <Plus className="w-4 h-4" /> Adicionar janela de atendimento
        </button>
      </div>
    </div>
  );
}

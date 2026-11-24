'use client';

import { Plus, Trash2 } from 'lucide-react';
import { maskCpf } from '@/lib/cpf';
import { MAXIMO_PARTICIPANTES, type ParticipanteVinculo } from '@/lib/vinculoColetivo';

export interface ParticipanteForm {
  nome: string;
  cpf: string;
  /** Copia o endereço do responsável ao salvar. */
  mesmoEnderecoDoResponsavel: boolean;
}

export function participantesParaForm(lista?: readonly ParticipanteVinculo[]): ParticipanteForm[] {
  const base = (lista ?? []).map((item) => ({
    nome: item.nome, cpf: item.cpf ? maskCpf(item.cpf) : '', mesmoEnderecoDoResponsavel: Boolean(item.endereco),
  }));
  while (base.length < 2) base.push({ nome: '', cpf: '', mesmoEnderecoDoResponsavel: true });
  return base;
}

const entrada = 'block w-full rounded-xl border border-line bg-slate-50 px-3 py-2 text-xs text-ink focus:border-psi-vibrant focus:outline-none';

/**
 * Participantes do casal, família ou grupo (especificação final, 6.04). Eles
 * ficam identificados no vínculo sem virar pacientes ativos.
 */
export function ParticipantesCampos({ value, onChange }: {
  value: ParticipanteForm[];
  onChange: (value: ParticipanteForm[]) => void;
}) {
  const alterar = (indice: number, parcial: Partial<ParticipanteForm>) =>
    onChange(value.map((item, posicao) => (posicao === indice ? { ...item, ...parcial } : item)));

  return (
    <div className="space-y-2">
      {value.map((participante, indice) => (
        <div key={indice} className="grid grid-cols-1 gap-2 rounded-xl border border-psi-soft/60 bg-white p-2.5 sm:grid-cols-[1fr_9rem_auto]">
          <input
            aria-label={`Nome do participante ${indice + 1}`}
            placeholder={`Participante ${indice + 1} — nome completo`}
            value={participante.nome}
            onChange={(event) => alterar(indice, { nome: event.target.value })}
            className={entrada}
          />
          <input
            aria-label={`CPF do participante ${indice + 1}`}
            placeholder="CPF (opcional)"
            value={participante.cpf}
            maxLength={14}
            inputMode="numeric"
            onChange={(event) => alterar(indice, { cpf: maskCpf(event.target.value) })}
            className={entrada}
          />
          <button
            type="button"
            aria-label={`Remover participante ${indice + 1}`}
            disabled={value.length <= 2}
            onClick={() => onChange(value.filter((_, posicao) => posicao !== indice))}
            className="flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-line text-muted hover:text-rose-600 disabled:opacity-40"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-muted sm:col-span-3">
            <input
              type="checkbox"
              checked={participante.mesmoEnderecoDoResponsavel}
              onChange={(event) => alterar(indice, { mesmoEnderecoDoResponsavel: event.target.checked })}
            />
            Mesmo endereço do responsável financeiro
          </label>
        </div>
      ))}
      {value.length < MAXIMO_PARTICIPANTES && (
        <button
          type="button"
          onClick={() => onChange([...value, { nome: '', cpf: '', mesmoEnderecoDoResponsavel: true }])}
          className="flex items-center gap-1 text-[11px] font-bold text-psi-deep"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar participante
        </button>
      )}
    </div>
  );
}

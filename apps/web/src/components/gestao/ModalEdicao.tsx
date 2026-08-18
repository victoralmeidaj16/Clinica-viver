import React, { useState } from 'react';
import { LISTA_NECESSIDADES } from '@/components/forms/necessidades';
import {
  PUBLICO_ALVO,
  TIPOS_ATENDIMENTO,
  SERVICOS_PRESTADOS,
  TURNOS_PSICOLOGO,
  comValoresRegistrados,
} from '@/components/forms/opcoesPsicologo';
import { PsicologoItem } from './types';

export function ModalEdicao({
  psicologo,
  onSalvar,
  onCancelar,
}: {
  psicologo: PsicologoItem;
  onSalvar: (mudancas: Record<string, unknown>) => void;
  onCancelar: () => void;
}) {
  const [turnos, setTurnos] = useState<string[]>([...(psicologo.turnosDisponiveis ?? [])]);
  const [servicos, setServicos] = useState<string[]>([...(psicologo.servicosPrestados ?? [])]);
  const [publicos, setPublicos] = useState<string[]>([...(psicologo.publicoAlvo ?? [])]);
  const [necessidades, setNecessidades] = useState<string[]>([
    ...(psicologo.necessidadesAtendidas ?? []),
  ]);
  const [publicoOutro, setPublicoOutro] = useState(psicologo.publicoAlvoOutro ?? '');
  const [necessidadeOutra, setNecessidadeOutra] = useState(psicologo.necessidadesOutro ?? '');
  const [preferencia, setPreferencia] = useState(psicologo.atendimentoPreferencia ?? 'AMBOS');
  const [aviso, setAviso] = useState<string | null>(null);

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];

  const chip = (marcado: boolean) =>
    `cursor-pointer px-2.5 py-1.5 rounded-lg border text-[11px] font-bold transition-all ${
      marcado
        ? 'bg-purple-50 border-purple-400 text-purple-900'
        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
    }`;

  const salvar = () => {
    if (turnos.length === 0) {
      setAviso('Selecione ao menos um turno — sem turno o profissional nunca recebe encaminhamento.');
      return;
    }
    onSalvar({
      turnosDisponiveis: turnos,
      servicosPrestados: servicos,
      publicoAlvo: publicos,
      publicoAlvoOutro: publicoOutro.trim(),
      necessidadesAtendidas: necessidades,
      necessidadesOutro: necessidadeOutra.trim(),
      especificarNecessidades: necessidades.length > 0 || Boolean(necessidadeOutra.trim()),
      atendimentoPreferencia: preferencia,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-lg font-black text-slate-900">
            Critérios de encaminhamento — {psicologo.nomeSocial?.trim() || psicologo.nomeCompleto}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            É por estes campos que o rodízio decide quem recebe cada paciente.
          </p>
        </div>

        {aviso && (
          <p className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            {aviso}
          </p>
        )}

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Turnos
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TURNOS_PSICOLOGO.map((turno) => (
              <label key={turno.value} className={chip(turnos.includes(turno.value))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={turnos.includes(turno.value)}
                  onChange={() => setTurnos(alternar(turnos, turno.value))}
                />
                {turno.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Serviços prestados
          </label>
          <div className="flex flex-wrap gap-1.5">
            {comValoresRegistrados(SERVICOS_PRESTADOS, servicos).map((servico) => (
              <label key={servico} className={chip(servicos.includes(servico))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={servicos.includes(servico)}
                  onChange={() => setServicos(alternar(servicos, servico))}
                />
                {servico}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Público atendido
          </label>
          <div className="flex flex-wrap gap-1.5">
            {comValoresRegistrados(PUBLICO_ALVO, publicos).map((publico) => (
              <label key={publico} className={chip(publicos.includes(publico))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={publicos.includes(publico)}
                  onChange={() => setPublicos(alternar(publicos, publico))}
                />
                {publico}
              </label>
            ))}
          </div>
          <input
            value={publicoOutro}
            onChange={(e) => setPublicoOutro(e.target.value)}
            placeholder="Outro público declarado no cadastro"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-purple-400"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Demandas específicas
          </label>
          <div className="flex flex-wrap gap-1.5">
            {LISTA_NECESSIDADES.map((necessidade) => (
              <label key={necessidade} className={chip(necessidades.includes(necessidade))}>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={necessidades.includes(necessidade)}
                  onChange={() => setNecessidades(alternar(necessidades, necessidade))}
                />
                {necessidade}
              </label>
            ))}
          </div>
          <input
            value={necessidadeOutra}
            onChange={(e) => setNecessidadeOutra(e.target.value)}
            placeholder="Outra demanda declarada no cadastro"
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 outline-none focus:border-purple-400"
          />
          <p className="text-[10px] text-slate-400 mt-1.5">
            Lista vazia significa &quot;atende qualquer demanda&quot;, não &quot;nenhuma&quot;.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
            Tipo de atendimento
          </label>
          <div className="flex flex-wrap gap-1.5">
            {TIPOS_ATENDIMENTO.map((tipo) => (
              <label key={tipo.value} className={chip(preferencia === tipo.value)}>
                <input
                  type="radio"
                  className="sr-only"
                  checked={preferencia === tipo.value}
                  onChange={() => setPreferencia(tipo.value as 'PARTICULAR' | 'SOCIAL' | 'AMBOS')}
                />
                {tipo.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex gap-2 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={salvar}
            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl"
          >
            Salvar critérios
          </button>
          <button
            type="button"
            onClick={onCancelar}
            className="border border-slate-200 text-slate-600 font-extrabold text-xs px-5 py-2.5 rounded-2xl hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

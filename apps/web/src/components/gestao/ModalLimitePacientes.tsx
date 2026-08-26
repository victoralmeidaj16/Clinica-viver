'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, Save, UsersRound, X } from 'lucide-react';
import {
  LIMITE_PACIENTES_MAXIMO,
  LIMITE_PACIENTES_MINIMO,
  limitePacientesValido,
  mensagemLimitePacientesInvalido,
} from '@/lib/psychologistCapacity';
import type { PsicologoItem } from './types';

type Props = {
  psicologos: readonly PsicologoItem[];
  alvo?: PsicologoItem;
  onSalvar: (limite: number) => Promise<boolean>;
  onCancelar: () => void;
};

const nomeExibido = (psicologo: PsicologoItem) =>
  psicologo.nomeSocial?.trim() || psicologo.nomeCompleto;

export function ModalLimitePacientes({ psicologos, alvo, onSalvar, onCancelar }: Props) {
  const emMassa = !alvo;
  const [valor, setValor] = useState(String(alvo?.limitePacientesAtivos ?? 5));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const limite = Number(valor);

  const acimaDoNovoLimite = useMemo(
    () =>
      psicologos.filter(
        (psicologo) =>
          Number.isInteger(limite) && (psicologo.pacientesAtivosCount ?? 0) > limite
      ).length,
    [limite, psicologos]
  );

  const salvar = async (event: React.FormEvent) => {
    event.preventDefault();
    setErro(null);
    if (!limitePacientesValido(limite)) {
      setErro(mensagemLimitePacientesInvalido());
      return;
    }

    setSalvando(true);
    try {
      const salvo = await onSalvar(limite);
      if (!salvo) setErro('Não foi possível salvar o novo limite. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
      <form
        onSubmit={salvar}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between bg-slate-900 px-6 py-5 text-white">
          <div className="flex gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/20 text-purple-200">
              <UsersRound className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[.2em] text-purple-300">
                Capacidade clínica
              </p>
              <h2 className="mt-1 text-lg font-black">
                {emMassa ? 'Definir limite para todos' : `Limite de ${nomeExibido(alvo)}`}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {emMassa
                  ? `A mesma capacidade será aplicada aos ${psicologos.length} psicólogos cadastrados.`
                  : `${alvo.pacientesAtivosCount ?? 0} paciente(s) ativo(s) neste momento.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            aria-label="Fechar"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <label className="block">
            <span className="text-xs font-extrabold text-slate-700">Máximo de pacientes ativos</span>
            <div className="mt-2 flex items-center rounded-2xl border border-slate-300 bg-slate-50 px-4 transition focus-within:border-purple-600 focus-within:ring-2 focus-within:ring-purple-100">
              <input
                autoFocus
                type="number"
                min={LIMITE_PACIENTES_MINIMO}
                max={LIMITE_PACIENTES_MAXIMO}
                step={1}
                value={valor}
                onChange={(event) => setValor(event.target.value)}
                className="min-w-0 flex-1 bg-transparent py-3 text-2xl font-black text-slate-900 outline-none"
              />
              <span className="text-xs font-bold text-slate-500">pacientes</span>
            </div>
            <span className="mt-1.5 block text-[11px] text-slate-500">
              Informe um número entre {LIMITE_PACIENTES_MINIMO} e {LIMITE_PACIENTES_MAXIMO}.
            </span>
          </label>

          {acimaDoNovoLimite > 0 && (
            <div className="flex gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                {acimaDoNovoLimite} psicólogo{acimaDoNovoLimite > 1 ? 's ficarão' : ' ficará'} acima
                do novo limite. Nenhum paciente será removido; apenas novos encaminhamentos serão
                bloqueados até surgir uma vaga.
              </p>
            </div>
          )}

          {erro && (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancelar}
              disabled={salvando}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-extrabold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvando || psicologos.length === 0}
              className="flex items-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-xs font-extrabold text-white shadow-md shadow-purple-700/20 transition hover:bg-purple-800 active:scale-95 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {salvando ? 'Salvando...' : emMassa ? 'Aplicar a todos' : 'Salvar limite'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

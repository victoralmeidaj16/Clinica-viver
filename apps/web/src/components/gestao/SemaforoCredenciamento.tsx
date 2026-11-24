import React from 'react';
import { CheckCircle2, Circle, HelpCircle, MailPlus } from 'lucide-react';
import { PsicologoItem } from './types';
import { COR_ICONE, TAG_NEUTRA } from './TagStatus';

export function SemaforoCredenciamento({
  psicologo,
  reenviando = false,
  onReenviar,
}: {
  psicologo: PsicologoItem;
  reenviando?: boolean;
  onReenviar?: (psicologo: PsicologoItem) => void;
}) {
  if (psicologo.status !== 'APROVADO') return null;

  const marcos: Array<[string, boolean | undefined]> = [
    ['Acesso criado', Boolean(psicologo.acessoCriadoEm || psicologo.usuarioRef)],
    ['Convite enviado', Boolean(psicologo.boasVindasEnviadaEm)],
    ['Conta ativada', psicologo.contaAtivada],
  ];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {marcos.map(([rotulo, feito]) => (
        <span
          key={rotulo}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 border border-slate-200 bg-white ${
            feito === undefined ? 'text-slate-400' : 'text-slate-700'
          }`}
          title={feito === undefined ? 'Indisponível em modo demonstração' : undefined}
        >
          {feito === undefined ? (
            <HelpCircle aria-hidden className={`w-3 h-3 ${COR_ICONE.neutro}`} />
          ) : feito ? (
            <CheckCircle2 aria-hidden className={`w-3 h-3 ${COR_ICONE.positivo}`} />
          ) : (
            <Circle aria-hidden className={`w-3 h-3 ${COR_ICONE.neutro}`} />
          )}
          {rotulo}
        </span>
      ))}
      {onReenviar && (
        <button
          type="button"
          disabled={reenviando}
          onClick={() => onReenviar(psicologo)}
          className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 hover:bg-slate-50 disabled:opacity-50 ${TAG_NEUTRA}`}
        >
          <MailPlus aria-hidden className={`w-3 h-3 ${COR_ICONE.marca}`} />
          {reenviando ? 'Reenviando…' : 'Reenviar convite'}
        </button>
      )}
    </div>
  );
}

import React from 'react';
import { CheckCircle2, Circle, HelpCircle } from 'lucide-react';
import { PsicologoItem } from './types';

export function SemaforoCredenciamento({ psicologo }: { psicologo: PsicologoItem }) {
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
          className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex items-center gap-1 ${
            feito === undefined
              ? 'bg-slate-50 text-slate-400 border-slate-200'
              : feito
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-500 border-slate-200'
          }`}
          title={feito === undefined ? 'Indisponível em modo demonstração' : undefined}
        >
          {feito === undefined ? (
            <HelpCircle className="w-3 h-3" />
          ) : feito ? (
            <CheckCircle2 className="w-3 h-3" />
          ) : (
            <Circle className="w-3 h-3" />
          )}
          {rotulo}
        </span>
      ))}
    </div>
  );
}

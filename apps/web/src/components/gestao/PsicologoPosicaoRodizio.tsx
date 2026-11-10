import type { PosicaoRodizio } from '@/lib/posicaoRodizio';

export function PsicologoPosicaoRodizio({ rodizio }: { rodizio?: PosicaoRodizio }) {
  const naFila = rodizio?.posicao != null;
  return (
    <div className="mt-2 space-y-0.5">
      <p className={`text-xs font-extrabold ${naFila ? 'text-purple-800' : 'text-slate-500'}`}>
        {naFila ? `Rodízio geral: ${rodizio.posicao}º de ${rodizio.total}`
          : rodizio ? `Fora do rodízio: ${rodizio.motivo ?? 'Indisponível'}` : 'Posição no rodízio indisponível'}
      </p>
      {naFila && <p className="text-[10px] leading-relaxed text-slate-500">A indicação depende da compatibilidade com o paciente.</p>}
    </div>
  );
}

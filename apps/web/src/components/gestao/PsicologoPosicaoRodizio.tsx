import type { PosicaoRodizio } from '@/lib/posicaoRodizio';

export function PsicologoPosicaoRodizio({ rodizio }: { rodizio?: PosicaoRodizio }) {
  const naFila = rodizio?.posicao != null;
  return (
    <div className="mt-0.5 min-w-0">
      <p
        className={`truncate text-[13px] font-semibold ${naFila ? 'text-psi-deep' : 'text-muted'}`}
        title={naFila ? 'A indicação depende da compatibilidade com o paciente.' : undefined}
      >
        {naFila ? `Rodízio geral: ${rodizio.posicao}º de ${rodizio.total}${rodizio.empate ? ' (empate, decidido por sorteio)' : ''}`
          : rodizio ? `Fora do rodízio: ${rodizio.motivo ?? 'Indisponível'}` : 'Posição no rodízio indisponível'}
      </p>
    </div>
  );
}

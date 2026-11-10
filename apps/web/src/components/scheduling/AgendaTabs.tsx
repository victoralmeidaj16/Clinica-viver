import type { AbaAgenda } from './AgendaTour';

interface Props {
  aba: AbaAgenda;
  setAba: (aba: AbaAgenda) => void;
  totalSessoes: number;
}

export function AgendaTabs({ aba, setAba, totalSessoes }: Props) {
  return (
    <div
      id="agenda-abas"
      role="tablist"
      aria-label="Áreas da agenda"
      className="sticky top-[4.5rem] z-20 flex gap-1.5 overflow-x-auto rounded-[18px] border border-line bg-surface p-1.5 shadow-card sm:top-[5.5rem]"
    >
      {([
        ['sessoes', 'Sessões e confirmações'],
        ['agenda', 'Agenda e disponibilidade'],
      ] as const).map(([valor, rotulo]) => {
        const ativa = aba === valor;
        return (
          <button
            key={valor}
            type="button"
            role="tab"
            id={`aba-${valor}`}
            aria-selected={ativa}
            aria-controls={`painel-${valor}`}
            onClick={() => setAba(valor)}
            className={`flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-[13px] px-4 py-3 text-[13px] font-extrabold transition ${
              ativa ? 'bg-psi-darkest text-white' : 'text-muted hover:bg-canvas hover:text-ink'
            }`}
          >
            {rotulo}
            {valor === 'sessoes' && (
              <span className={`rounded-full px-2 py-px text-[10.5px] tabular-nums ${ativa ? 'bg-psi-vibrant text-white' : 'bg-psi-soft text-psi-deep'}`}>
                {totalSessoes}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

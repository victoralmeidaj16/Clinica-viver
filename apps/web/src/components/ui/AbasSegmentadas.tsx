/**
 * Barra de abas no padrão da página de referência (Agenda & Horários):
 * barra branca com as abas dentro, aba ativa em `psi-darkest`. Cada aba
 * aponta para o painel `painel-<valor>` (role="tabpanel").
 */
export function AbasSegmentadas<Valor extends string>({
  abas,
  ativa,
  onTrocar,
  rotulo,
}: {
  abas: ReadonlyArray<readonly [Valor, string]>;
  ativa: Valor;
  onTrocar: (valor: Valor) => void;
  rotulo: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={rotulo}
      className="flex gap-1.5 overflow-x-auto rounded-[18px] border border-line bg-surface p-1.5 shadow-card"
    >
      {abas.map(([valor, texto]) => {
        const selecionada = ativa === valor;
        return (
          <button
            key={valor}
            type="button"
            role="tab"
            id={`aba-${valor}`}
            aria-selected={selecionada}
            aria-controls={`painel-${valor}`}
            onClick={() => onTrocar(valor)}
            className={`flex flex-1 shrink-0 items-center justify-center whitespace-nowrap rounded-[13px] px-4 py-3 text-[13px] font-extrabold transition ${
              selecionada ? 'bg-psi-darkest text-white' : 'text-muted hover:bg-canvas hover:text-ink'
            }`}
          >
            {texto}
          </button>
        );
      })}
    </div>
  );
}

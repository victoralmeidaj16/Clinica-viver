export type SecaoVitrine = 'SERVICOS' | 'PROFISSIONAIS';

const secoes = [
  { id: 'SERVICOS', label: 'Serviços Clínicos Oferecidos' },
  { id: 'PROFISSIONAIS', label: 'Conheça Nossos Profissionais' },
] as const satisfies readonly { id: SecaoVitrine; label: string }[];

interface SecaoVitrineNavProps {
  ativa: SecaoVitrine;
  onNavegar: (secao: SecaoVitrine) => void;
}

/**
 * Faixa do header que acompanha a rolagem da vitrine: mostra em qual seção o
 * visitante está e permite pular entre elas. A seção ativa é atualizada por um
 * IntersectionObserver na própria página.
 */
export function SecaoVitrineNav({ ativa, onNavegar }: SecaoVitrineNavProps) {
  return (
    <nav
      aria-label="Navegação das seções da vitrine"
      className="border-t border-purple-100 bg-purple-50/50"
    >
      <ol className="mx-auto grid max-w-6xl grid-cols-2 px-4 sm:px-6">
        {secoes.map((secao) => {
          const estaAtiva = ativa === secao.id;

          return (
            <li key={secao.id} className="relative min-w-0">
              <button
                type="button"
                onClick={() => onNavegar(secao.id)}
                aria-current={estaAtiva ? 'true' : undefined}
                className={`w-full truncate px-1 pb-2.5 pt-2.5 text-center text-[11px] font-black transition-colors sm:px-3 sm:text-xs ${
                  estaAtiva ? 'text-purple-800' : 'text-slate-500 hover:text-purple-700'
                }`}
              >
                {secao.label}
              </button>
              <span
                aria-hidden="true"
                className={`absolute inset-x-2 bottom-0 h-1 rounded-t-full transition-all duration-300 sm:inset-x-4 ${
                  estaAtiva ? 'bg-purple-600' : 'bg-transparent'
                }`}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

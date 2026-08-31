export type SecaoVitrine = 'SERVICOS' | 'PROFISSIONAIS' | 'DUVIDAS';

/**
 * Na ordem em que as seções aparecem na página — a navegação e o observador de
 * rolagem dependem disso para destacar a seção certa.
 */
export const SECOES_VITRINE = [
  { id: 'SERVICOS', label: 'Escolha Seu Serviço', ancora: 'secao-escolha-servico' },
  { id: 'PROFISSIONAIS', label: 'Conheça Nossos Profissionais', ancora: 'secao-profissionais' },
  { id: 'DUVIDAS', label: 'Dúvidas Frequentes', ancora: 'secao-duvidas' },
] as const satisfies readonly { id: SecaoVitrine; label: string; ancora: string }[];

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
      <ol className="mx-auto grid max-w-6xl grid-cols-3 px-4 sm:px-6">
        {SECOES_VITRINE.map((secao) => {
          const estaAtiva = ativa === secao.id;

          return (
            <li key={secao.id} className="relative min-w-0">
              <button
                type="button"
                onClick={() => onNavegar(secao.id)}
                aria-current={estaAtiva ? 'true' : undefined}
                className={`w-full truncate px-1 pb-2 pt-2 text-center text-[10px] font-black transition-colors sm:px-3 sm:text-[11px] ${
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

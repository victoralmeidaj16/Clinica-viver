import { Check } from 'lucide-react';

export type BookingStep =
  | 'SERVICOS'
  | 'CAMINHO'
  | 'MATCH'
  | 'MATCH_RECOMENDACOES'
  | 'PROFISSIONAIS'
  | 'FORMULARIO'
  | 'SUCESSO';

interface BookingProgressProps {
  step: BookingStep;
}

const stages = [
  { label: 'Serviço', description: 'Escolha a modalidade' },
  { label: 'Preferência', description: 'Defina como escolher' },
  { label: 'Profissional', description: 'Encontre seu psicólogo' },
  { label: 'Seus dados', description: 'Finalize a solicitação' },
] as const;

export function bookingStageIndex(step: BookingStep) {
  if (step === 'SERVICOS') return 0;
  if (step === 'CAMINHO') return 1;
  if (step === 'MATCH' || step === 'MATCH_RECOMENDACOES' || step === 'PROFISSIONAIS') return 2;
  return 3;
}

export function BookingProgress({ step }: BookingProgressProps) {
  const current = bookingStageIndex(step);
  const completedFlow = step === 'SUCESSO';

  return (
    <nav
      id="agendamento-etapas"
      aria-label="Etapas do agendamento"
      className="border-t border-purple-100 bg-purple-50/50"
    >
      <ol className="mx-auto grid max-w-6xl grid-cols-4 px-4 sm:px-6">
        {stages.map((stage, index) => {
          const active = index === current;
          const complete = index < current || completedFlow;

          return (
            <li
              key={stage.label}
              aria-current={active ? 'step' : undefined}
              className={`relative min-w-0 px-1 pb-2 pt-2 text-center transition-colors sm:px-3 ${
                active ? 'text-purple-800' : complete ? 'text-purple-600' : 'text-slate-400'
              }`}
            >
              <span className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-black sm:hidden">
                {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span className="block truncate text-[10px] font-black sm:text-xs">
                <span className="hidden sm:inline">{complete ? '✓ ' : `${index + 1}. `}</span>
                {stage.label}
              </span>
              <span className="mt-0.5 hidden truncate text-[10px] font-medium text-slate-400 lg:block">
                {stage.description}
              </span>
              <span
                aria-hidden="true"
                className={`absolute inset-x-2 bottom-0 h-1 rounded-t-full transition-all duration-300 sm:inset-x-4 ${
                  active ? 'bg-purple-600' : 'bg-transparent'
                }`}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

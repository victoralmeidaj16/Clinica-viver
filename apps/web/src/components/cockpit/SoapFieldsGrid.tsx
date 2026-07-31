'use client';

interface SoapFieldsGridProps {
  subjetivo: string;
  objetivo: string;
  avaliacao: string;
  plano: string;
  onSubjetivoChange: (value: string) => void;
  onObjetivoChange: (value: string) => void;
  onAvaliacaoChange: (value: string) => void;
  onPlanoChange: (value: string) => void;
}

const fields = [
  {
    key: 'subjetivo',
    letter: 'S',
    label: 'Subjetivo (Relato do Paciente)',
    placeholder: 'Queixas, relatos emocionais e falas marcantes...',
  },
  {
    key: 'objetivo',
    letter: 'O',
    label: 'Objetivo (Observações Clínicas)',
    placeholder: 'Postura, afeto, exame do estado mental e sinais observados...',
  },
  {
    key: 'avaliacao',
    letter: 'A',
    label: 'Avaliação (Análise Técnica & Evolução)',
    placeholder: 'Hipóteses diagnósticas, formulação de caso e progresso...',
  },
  {
    key: 'plano',
    letter: 'P',
    label: 'Plano (Condutas & Intervenções)',
    placeholder: 'Encaminhamentos, técnicas e combinado para a próxima sessão...',
  },
] as const;

export default function SoapFieldsGrid({
  subjetivo,
  objetivo,
  avaliacao,
  plano,
  onSubjetivoChange,
  onObjetivoChange,
  onAvaliacaoChange,
  onPlanoChange,
}: SoapFieldsGridProps) {
  const values = { subjetivo, objetivo, avaliacao, plano };
  const handlers = {
    subjetivo: onSubjetivoChange,
    objetivo: onObjetivoChange,
    avaliacao: onAvaliacaoChange,
    plano: onPlanoChange,
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {fields.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <label
            htmlFor={`soap-${field.key}`}
            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary text-[10px] text-white">
              {field.letter}
            </span>
            {field.label}
          </label>
          <textarea
            id={`soap-${field.key}`}
            value={values[field.key]}
            onChange={(event) => handlers[field.key](event.target.value)}
            rows={4}
            className="input text-xs leading-relaxed"
            placeholder={field.placeholder}
          />
        </div>
      ))}
    </div>
  );
}

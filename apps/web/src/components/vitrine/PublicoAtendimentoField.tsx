'use client';

import type { PublicoVitrine } from '@thats-life/core';

interface PublicoAtendimentoFieldProps {
  opcoes: readonly PublicoVitrine[];
  value: string;
  outroValue: string;
  onChange: (value: PublicoVitrine) => void;
  onOutroChange: (value: string) => void;
}

export function PublicoAtendimentoField({
  opcoes,
  value,
  outroValue,
  onChange,
  onOutroChange,
}: PublicoAtendimentoFieldProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {opcoes.map((opcao) => (
          <button
            key={opcao}
            type="button"
            aria-pressed={value === opcao}
            onClick={() => onChange(opcao)}
            className={`rounded-xl border p-3 text-left text-xs font-bold transition-all ${
              value === opcao
                ? 'border-psi-vibrant bg-psi-soft text-psi-darkest'
                : 'border-line bg-white text-muted hover:border-psi-soft'
            }`}
          >
            {opcao}
          </button>
        ))}
      </div>

      {value === 'Outro' && opcoes.includes('Outro') && (
        <input
          value={outroValue}
          onChange={(event) => onOutroChange(event.target.value)}
          placeholder="Especifique para quem é o atendimento"
          aria-label="Especifique para quem é o atendimento"
          className="input text-xs"
        />
      )}
    </div>
  );
}

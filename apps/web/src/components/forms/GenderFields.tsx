'use client';

import type { GenderValue } from '@/lib/gender';

interface Props {
  idPrefix: string;
  gender: GenderValue | '';
  other: string;
  onGenderChange: (value: GenderValue | '') => void;
  onOtherChange: (value: string) => void;
}

export function GenderFields({ idPrefix, gender, other, onGenderChange, onOtherChange }: Props) {
  const selectId = `${idPrefix}-genero`;
  const otherId = `${idPrefix}-genero-outro`;
  const inputClass = 'w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 font-medium';

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={selectId} className="font-bold text-slate-700 block mb-1">
          Gênero <span className="text-rose-500">*</span>
        </label>
        <select
          id={selectId}
          required
          value={gender}
          onChange={(event) => {
            const next = event.target.value as GenderValue | '';
            onGenderChange(next);
            if (next !== 'OUTRO') onOtherChange('');
          }}
          className={inputClass}
        >
          <option value="">Selecione o gênero</option>
          <option value="MASCULINO">Masculino</option>
          <option value="FEMININO">Feminino</option>
          <option value="OUTRO">Outro</option>
        </select>
      </div>

      {gender === 'OUTRO' && (
        <div className="animate-in fade-in slide-in-from-top-1 duration-200">
          <label htmlFor={otherId} className="font-bold text-slate-700 block mb-1">
            Como você descreve seu gênero? <span className="text-rose-500">*</span>
          </label>
          <input
            id={otherId}
            type="text"
            required
            maxLength={120}
            value={other}
            onChange={(event) => onOtherChange(event.target.value)}
            placeholder="Escreva como prefere informar"
            autoComplete="off"
            className={inputClass}
          />
        </div>
      )}
    </div>
  );
}

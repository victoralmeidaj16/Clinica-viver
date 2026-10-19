'use client';

import { useState } from 'react';
import { DURACAO_VARIAVEL_MAX, DURACAO_VARIAVEL_MIN, DURACOES_SESSAO } from '@/lib/duracaoSessao';
import { rotuloDuracao } from './availabilityStepsModel';

const VARIAVEL = 'variavel';

interface Props {
  value: number;
  onChange: (duracaoMin: number) => void;
  /** Só alunos de Avaliação Psicológica escolhem a própria duração. */
  permiteVariavel: boolean;
  className: string;
  ariaLabel?: string;
}

/**
 * Duração da sessão: 50 min, 1h30 ou, para quem pode, um tempo informado.
 *
 * Uma grade salva antes dessas opções (60 min, 40 min…) continua aparecendo
 * como está, para o psicólogo não ver um valor diferente do que vale hoje.
 */
export function SessionDurationField({ value, onChange, permiteVariavel, className, ariaLabel }: Props) {
  const fixa = (DURACOES_SESSAO as readonly number[]).includes(value);
  const [variavel, setVariavel] = useState(permiteVariavel && !fixa);
  const legado = !fixa && !permiteVariavel;

  return (
    <>
      <select
        aria-label={ariaLabel}
        value={variavel ? VARIAVEL : value}
        onChange={(evento) => {
          if (evento.target.value === VARIAVEL) {
            setVariavel(true);
            return;
          }
          setVariavel(false);
          onChange(Number(evento.target.value));
        }}
        className={className}
      >
        {DURACOES_SESSAO.map((valor) => <option key={valor} value={valor}>{rotuloDuracao(valor)}</option>)}
        {legado && <option value={value}>{rotuloDuracao(value)}</option>}
        {permiteVariavel && <option value={VARIAVEL}>Variável</option>}
      </select>
      {variavel && (
        <input
          type="number"
          inputMode="numeric"
          min={DURACAO_VARIAVEL_MIN}
          max={DURACAO_VARIAVEL_MAX}
          step={5}
          aria-label="Tempo da sessão em minutos"
          placeholder="Minutos"
          value={value}
          onChange={(evento) => {
            const minutos = Number(evento.target.value);
            if (Number.isFinite(minutos) && minutos > 0) onChange(Math.round(minutos));
          }}
          className={className}
        />
      )}
    </>
  );
}

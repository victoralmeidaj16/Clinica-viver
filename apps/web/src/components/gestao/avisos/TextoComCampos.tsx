'use client';

import { forwardRef, useRef } from 'react';

/** "nome_paciente" → "nome paciente": o rótulo legível de um campo dinâmico. */
export function rotuloDoCampo(nome: string) {
  return nome.replace(/_/g, ' ');
}

/** Pílula preenchida de um campo dinâmico, usada na lista de campos disponíveis. */
export const PILULA_CAMPO =
  'inline-flex items-center gap-1 rounded-full bg-psi-soft px-2.5 py-1 text-[11px] font-bold text-psi-darkest transition hover:bg-psi-vibrant hover:text-white';

const MARCADOR = /(\{\{\s*[a-z0-9_]+\s*\}\})/gi;

// Mesma caixa de texto nas duas camadas: qualquer diferença de fonte, padding
// ou borda desalinha o destaque do texto digitado.
const CAIXA =
  'block w-full whitespace-pre-wrap break-words rounded-xl border px-3 py-2 font-mono text-[12px] leading-5 [scrollbar-gutter:stable]';

/**
 * Textarea cujo texto continua sendo o modelo com `{{campo}}`, mas que mostra
 * cada campo como uma pílula preenchida. Uma camada por baixo repete o texto
 * com os marcadores destacados (chaves transparentes, que viram o respiro da
 * pílula); o textarea por cima tem o texto transparente e só o cursor visível.
 */
export const TextoComCampos = forwardRef<HTMLTextAreaElement, {
  value: string;
  onChange: (valor: string) => void;
  rows: number;
}>(function TextoComCampos({ value, onChange, rows }, ref) {
  const camada = useRef<HTMLDivElement>(null);
  const partes = value.split(MARCADOR);

  return (
    <div className="relative mt-1 rounded-xl bg-white">
      <div ref={camada} aria-hidden
        className={`${CAIXA} pointer-events-none absolute inset-0 overflow-hidden border-transparent font-normal text-ink`}>
        {partes.map((parte, indice) =>
          indice % 2 === 1 ? (
            <mark key={indice} className="rounded-full bg-psi-soft text-psi-darkest [box-decoration-break:clone]">
              <span className="text-transparent">{'{{'}</span>
              {parte.slice(2, -2)}
              <span className="text-transparent">{'}}'}</span>
            </mark>
          ) : (
            <span key={indice}>{parte}</span>
          )
        )}
        {/* Mantém a altura da última linha quando o texto termina em quebra. */}
        {'​'}
      </div>
      <textarea
        ref={ref}
        value={value}
        rows={rows}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (camada.current) camada.current.scrollTop = event.currentTarget.scrollTop;
        }}
        className={`${CAIXA} relative resize-y overflow-y-auto border-line bg-transparent font-normal text-transparent caret-ink selection:bg-psi-vibrant/25`}
      />
    </div>
  );
});

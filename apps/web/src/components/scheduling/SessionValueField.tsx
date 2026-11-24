'use client';

export function formatarReaisEntrada(centavos?: number): string {
  if (centavos == null || !Number.isFinite(centavos)) return '';
  return (centavos / 100).toFixed(2).replace('.', ',');
}

export function lerCentavosEntrada(texto: string): number | undefined {
  const limpo = texto.trim().replace(/\./g, '').replace(',', '.');
  if (!limpo) return undefined;
  const valor = Number(limpo);
  if (!Number.isFinite(valor) || valor <= 0) return Number.NaN;
  return Math.round(valor * 100);
}

export function SessionValueField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label htmlFor="valor-sessao-gestao" className="mb-1 block text-xs font-bold text-ink">
        Valor da sessão (R$)
      </label>
      <input
        id="valor-sessao-gestao"
        type="text"
        inputMode="decimal"
        placeholder="Ex.: 120,00"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="input w-full text-xs font-bold disabled:bg-slate-100 disabled:text-muted"
      />
      <p className="mt-1 text-[11px] text-muted">
        {disabled
          ? 'Cobrança já paga ou estornada: o valor original é preservado.'
          : 'Atualiza a cobrança em aberto e o crédito educacional correspondente.'}
      </p>
    </div>
  );
}

'use client';

import { Minus, Move, Plus, RotateCcw, Square } from 'lucide-react';
import { STAMP_WIDTH_MAX, STAMP_WIDTH_MIN, type CertificateStampQr } from '@thats-life/core';

type Align = 'left' | 'center' | 'right';

const rowClass = 'flex items-center justify-between gap-2 bg-[#FAF8FC] p-2 rounded-xl border border-line/60';
const labelClass = 'text-muted font-bold text-[11px]';
const stepButtonClass =
  'h-6 w-6 rounded bg-white hover:bg-psi-deep hover:text-white font-bold text-xs border border-line grid place-items-center';

function chipClass(active: boolean) {
  return `px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
    active ? 'bg-psi-deep text-white border-psi-deep' : 'bg-white text-muted border-line hover:text-ink'
  }`;
}

/** Card 3 do editor de certificado: forma, fonte, QR e texto do carimbo do verso. */
export function StampSettingsCard({
  stampX,
  stampY,
  fontSize,
  onFontSize,
  width,
  onWidth,
  onMakeSquare,
  align,
  onAlign,
  qr,
  onQr,
  text,
  isCustomText,
  onText,
  onResetText,
}: {
  stampX: number;
  stampY: number;
  fontSize: number;
  onFontSize: (size: number) => void;
  width: number;
  onWidth: (width: number) => void;
  onMakeSquare: () => void;
  align: Align;
  onAlign: (align: Align) => void;
  qr: CertificateStampQr | null;
  onQr: (qr: CertificateStampQr | null) => void;
  text: string;
  isCustomText: boolean;
  onText: (text: string) => void;
  onResetText: () => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-card space-y-3">
      <div className="border-b border-line pb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
          <Move className="w-3.5 h-3.5 text-psi-vibrant" />
          4. Ajustes do Carimbo (Verso)
        </span>
        <span className="font-mono text-[10px] font-bold text-muted">
          X: {stampX}% | Y: {stampY}%
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className={rowClass}>
          <span className={labelClass}>Tamanho da Fonte:</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => onFontSize(Math.max(8, fontSize - 1))} className={stepButtonClass}>
              <Minus className="w-3 h-3" />
            </button>
            <span className="font-mono font-bold px-2">{fontSize}px</span>
            <button type="button" onClick={() => onFontSize(Math.min(32, fontSize + 1))} className={stepButtonClass}>
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className={`${rowClass} flex-wrap`}>
          <span className={labelClass}>Largura:</span>
          <div className="flex items-center gap-2 flex-1 justify-end min-w-[180px]">
            <input
              type="range"
              min={STAMP_WIDTH_MIN}
              max={STAMP_WIDTH_MAX}
              step={1}
              value={width}
              onChange={(e) => onWidth(Number(e.target.value))}
              className="flex-1 accent-psi-deep"
              aria-label="Largura do carimbo"
            />
            <span className="font-mono font-bold w-9 text-right">{Math.round(width)}%</span>
            <button
              type="button"
              onClick={onMakeSquare}
              title="Ajusta a largura para o carimbo ficar quadrado"
              className={`${chipClass(false)} flex items-center gap-1`}
            >
              <Square className="w-3 h-3" />
              Quadrado
            </button>
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>Alinhamento:</span>
          <div className="flex gap-1">
            {(['left', 'center', 'right'] as const).map((option) => (
              <button key={option} type="button" onClick={() => onAlign(option)} className={chipClass(align === option)}>
                {option === 'left' ? '⬅ Esq' : option === 'center' ? '↔ Cent' : 'Dir ➡'}
              </button>
            ))}
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>QR code:</span>
          <div className="flex gap-1">
            {([
              [null, 'Sem QR'],
              ['left', 'Ao lado'],
              ['top', 'Acima'],
            ] as const).map(([option, label]) => (
              <button key={label} type="button" onClick={() => onQr(option)} className={chipClass(qr === option)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5 bg-[#FAF8FC] p-2 rounded-xl border border-line/60">
          <div className="flex items-center justify-between">
            <span className={labelClass}>Texto do carimbo:</span>
            {isCustomText && (
              <button
                type="button"
                onClick={onResetText}
                className="text-[10px] text-psi-vibrant hover:underline font-bold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Voltar ao automático
              </button>
            )}
          </div>
          <textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            rows={5}
            className="input py-2 text-[11px] font-mono leading-snug resize-y"
            aria-label="Texto do carimbo"
          />
          <p className="text-[10px] text-muted leading-snug">
            {isCustomText
              ? 'Texto editado à mão: mudanças no código, carga horária ou data acima não atualizam mais o carimbo.'
              : 'Gerado dos dados acima. Edite livremente se precisar de outro texto.'}
          </p>
        </div>
      </div>
    </div>
  );
}

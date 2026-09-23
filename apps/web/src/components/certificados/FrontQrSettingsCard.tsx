'use client';

import { Minus, Plus, QrCode, RotateCcw } from 'lucide-react';
import {
  DEFAULT_FRONT_QR_SIZE,
  DEFAULT_FRONT_QR_X,
  DEFAULT_FRONT_QR_Y,
  FRONT_QR_SIZE_MAX,
  FRONT_QR_SIZE_MIN,
} from '@thats-life/core';

const rowClass = 'flex items-center justify-between gap-2 bg-[#FAF8FC] p-2 rounded-xl border border-line/60';
const labelClass = 'text-muted font-bold text-[11px]';
const stepButtonClass =
  'h-6 w-6 rounded bg-white hover:bg-psi-deep hover:text-white font-bold text-xs border border-line grid place-items-center transition-colors';

function chipClass(active: boolean) {
  return `px-2.5 py-1 rounded text-[10px] font-bold border transition-colors ${
    active ? 'bg-psi-deep text-white border-psi-deep' : 'bg-white text-muted border-line hover:text-ink'
  }`;
}

export function FrontQrSettingsCard({
  enabled,
  onToggle,
  frontQrX,
  frontQrY,
  size,
  onSize,
  onResetPosition,
}: {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  frontQrX: number;
  frontQrY: number;
  size: number;
  onSize: (size: number) => void;
  onResetPosition: () => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5 shadow-card space-y-3">
      <div className="border-b border-line pb-2 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-psi-deep flex items-center gap-1.5">
          <QrCode className="w-3.5 h-3.5 text-psi-vibrant" />
          3. QR Code da Frente
        </span>
        {enabled && (
          <span className="font-mono text-[10px] font-bold text-muted">
            X: {frontQrX}% | Y: {frontQrY}%
          </span>
        )}
      </div>

      <div className="space-y-2 text-xs">
        <div className={rowClass}>
          <span className={labelClass}>Exibir QR na Frente:</span>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onToggle(true)}
              className={chipClass(enabled)}
            >
              ✓ Ativado
            </button>
            <button
              type="button"
              onClick={() => onToggle(false)}
              className={chipClass(!enabled)}
            >
              ✕ Desativado
            </button>
          </div>
        </div>

        {enabled ? (
          <>
            <div className={`${rowClass} flex-wrap`}>
              <span className={labelClass}>Tamanho do QR:</span>
              <div className="flex items-center gap-2 flex-1 justify-end min-w-[170px]">
                <button
                  type="button"
                  onClick={() => onSize(Math.max(FRONT_QR_SIZE_MIN, Math.round((size - 0.5) * 10) / 10))}
                  className={stepButtonClass}
                  title="Diminuir QR code"
                >
                  <Minus className="w-3 h-3" />
                </button>
                <input
                  type="range"
                  min={FRONT_QR_SIZE_MIN}
                  max={FRONT_QR_SIZE_MAX}
                  step={0.5}
                  value={size}
                  onChange={(e) => onSize(Number(e.target.value))}
                  className="flex-1 accent-psi-deep"
                  aria-label="Tamanho do QR code da frente"
                />
                <button
                  type="button"
                  onClick={() => onSize(Math.min(FRONT_QR_SIZE_MAX, Math.round((size + 0.5) * 10) / 10))}
                  className={stepButtonClass}
                  title="Aumentar QR code"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <span className="font-mono font-bold w-10 text-right">{size}%</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-muted leading-tight">
                💡 Arraste o QR diretamente na aba <strong>Frente</strong> para posicionar.
              </p>
              <button
                type="button"
                onClick={onResetPosition}
                className="text-[10px] text-psi-vibrant hover:underline font-bold flex items-center gap-1 shrink-0 ml-2"
                title={`Redefinir para o canto inferior direito (X: ${DEFAULT_FRONT_QR_X}%, Y: ${DEFAULT_FRONT_QR_Y}%)`}
              >
                <RotateCcw className="w-3 h-3" />
                Canto inferior direito
              </button>
            </div>
          </>
        ) : (
          <p className="text-[10px] text-muted italic p-2 bg-[#FAF8FC] rounded-xl border border-line/60">
            QR code desativado na frente. O carimbo oficial do verso continua contendo o registro acadêmico.
          </p>
        )}
      </div>
    </div>
  );
}

import type { CertificateStampQr } from '@thats-life/core';
import { QrCodeConferencia } from '@/components/declaracao/QrCodeConferencia';

/** Lado do QR em múltiplos da fonte do carimbo — o PDF usa a mesma proporção. */
export const STAMP_QR_FONT_RATIO = 7;

/**
 * Miolo do carimbo do verso: texto e, opcionalmente, o QR de conferência.
 * O mesmo desenho serve ao editor e à página pública, para o que se posiciona
 * ser o que se publica.
 */
export function CertificateStampContent({
  text,
  fontSize,
  align,
  qr,
  qrValue,
}: {
  text: string;
  fontSize: number;
  align: 'left' | 'center' | 'right';
  qr?: CertificateStampQr;
  qrValue: string;
}) {
  const qrSize = Math.round(fontSize * STAMP_QR_FONT_RATIO);
  const top = qr === 'top';
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: top ? 'column' : 'row',
        alignItems: top ? justify : 'center',
        gap: `${fontSize * 0.6}px`,
      }}
    >
      {qr ? <QrCodeConferencia valor={qrValue} tamanho={qrSize} className="shrink-0" /> : null}
      <p
        style={{ textAlign: align, overflowWrap: 'anywhere', width: top ? '100%' : undefined }}
        className="min-w-0 flex-1 font-mono text-ink whitespace-pre-line leading-tight font-medium"
      >
        {text}
      </p>
    </div>
  );
}

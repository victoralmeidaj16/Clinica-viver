import { STAMP_LINE_HEIGHT, STAMP_QR_FONT_RATIO, type CertificateStampQr } from '@thats-life/core';
import { QrCodeConferencia } from '@/components/declaracao/QrCodeConferencia';

/** Converte medidas do carimbo (unidades de `CERT_FONT_BASE_WIDTH`) em CSS relativo à largura da arte. */
export function certUnits(n: number): string {
  // 1 unidade = 1/1000 da largura do container da arte (`container-type: inline-size`).
  return `${n * 0.1}cqw`;
}

/**
 * Miolo do carimbo do verso: texto e, opcionalmente, o QR de conferência.
 * O mesmo desenho serve ao editor e à página pública, para o que se posiciona
 * ser o que se publica. Precisa estar dentro do container da arte.
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
  const qrSize = certUnits(fontSize * STAMP_QR_FONT_RATIO);
  const top = qr === 'top';
  const justify = align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: top ? 'column' : 'row',
        alignItems: top ? justify : 'center',
        gap: certUnits(fontSize * 0.6),
        fontSize: certUnits(fontSize),
        lineHeight: STAMP_LINE_HEIGHT,
      }}
    >
      {qr ? (
        <div className="shrink-0" style={{ width: qrSize, height: qrSize }}>
          <QrCodeConferencia valor={qrValue} className="block w-full h-full" />
        </div>
      ) : null}
      <p
        style={{ textAlign: align, overflowWrap: 'anywhere', width: top ? '100%' : undefined }}
        className="min-w-0 flex-1 font-mono text-ink whitespace-pre-line font-medium m-0"
      >
        {text}
      </p>
    </div>
  );
}

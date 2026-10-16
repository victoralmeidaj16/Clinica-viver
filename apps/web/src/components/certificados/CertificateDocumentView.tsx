'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Award, Check, Copy, Download, FileText, Printer } from 'lucide-react';
import {
  CertificateRecord,
  DEFAULT_FRONT_QR_SIZE,
  DEFAULT_STAMP_FONT_SIZE,
  DEFAULT_STAMP_X,
  DEFAULT_STAMP_Y,
  DEFAULT_STAMP_WIDTH,
  certificatePublicValidationUrl,
  CERTIFICATE_BAND_SHAPES,
  CERTIFICATE_BAND_WIDTH,
  CERTIFICATE_BRAND,
  CERTIFICATE_PAGE_HEIGHT,
  CERTIFICATE_PAGE_WIDTH,
  certificateBodyParts,
  certificateUsesBrandLayout,
  formatCertificateDuration,
  resolveCertificateStampText,
} from '@thats-life/core';
import { QrCodeConferencia } from '@/components/declaracao/QrCodeConferencia';
import { CertificateStampContent } from '@/components/certificados/CertificateStampContent';

interface Props {
  record: CertificateRecord;
  publicValidationUrl: string;
}

export function CertificateDocumentView({ record, publicValidationUrl }: Props) {
  const [copied, setCopied] = useState(false);

  const versoText = resolveCertificateStampText(record);
  // Cursos online com ministrante ignoram a arte gravada e usam o layout da marca.
  const brandLayout = certificateUsesBrandLayout(record);
  const frontImageUrl = brandLayout ? undefined : record.frontImageUrl;
  const backImageUrl = brandLayout ? undefined : record.backImageUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(publicValidationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Carimbo do verso: X/Y/largura em % da arte e fonte em milésimos da largura, como no PDF.
  const stamp =
    brandLayout || (record.stampX !== undefined && record.stampY !== undefined) ? (
      <div
        style={{
          position: 'absolute',
          left: `${record.stampX ?? DEFAULT_STAMP_X}%`,
          top: `${record.stampY ?? DEFAULT_STAMP_Y}%`,
          width: `${record.stampWidth || DEFAULT_STAMP_WIDTH}%`,
        }}
        className="z-10 select-text"
      >
        <CertificateStampContent
          text={versoText}
          fontSize={record.stampFontSize || DEFAULT_STAMP_FONT_SIZE}
          align={record.stampAlign || 'center'}
          qr={record.stampQr}
          qrValue={certificatePublicValidationUrl()}
        />
      </div>
    ) : null;

  const pdfDownloadUrl = `/api/public/certificados/${encodeURIComponent(record.code)}/pdf`;

  return (
    <div className="space-y-6">
      {/* Barra de Ações (Oculta na impressão) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-line shadow-sm">
        <div className="flex items-center gap-2 text-xs text-muted">
          <Award className="w-4 h-4 text-psi-vibrant" />
          <span>Visualizador Oficial de Documento Acadêmico</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleCopy}
            className="btn-outline py-2 px-3 text-xs font-bold"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Link Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Link</span>
              </>
            )}
          </button>

          <button
            onClick={() => window.print()}
            className="btn-outline py-2.5 px-4 text-xs font-bold flex items-center gap-1.5"
            title="Imprimir certificado"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir</span>
          </button>

          <a
            href={pdfDownloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            download={`Certificado-ViverMais-${record.code}.pdf`}
            className="btn-primary py-2.5 px-5 text-xs font-bold flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Baixar Certificado</span>
          </a>
        </div>
      </div>

      {/* DOCUMENTO IMPRIMÍVEL (SEM FRAMES EXCEDENTES) */}
      <div className="cert-printable space-y-6">
        {/* PÁGINA 1: FRENTE DO CERTIFICADO */}
        <div className="space-y-2 cert-page-break">
          <div className="no-print flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-psi-vibrant" />
              Página 1 · Frente do Certificado
            </span>
            <span className="text-xs font-mono font-bold text-psi-deep">ID: {record.code}</span>
          </div>

          <div
            style={{ containerType: 'size' }}
            className="cert-page relative aspect-[1.414/1] w-full bg-white rounded-2xl md:rounded-3xl border border-line overflow-hidden shadow-card flex items-center justify-center"
          >
            {frontImageUrl ? (
              <CertificateArtFrame src={frontImageUrl} alt="Frente do Certificado">
                {record.frontQrEnabled !== false && record.frontQrX != null && record.frontQrY != null && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${record.frontQrX}%`,
                      top: `${record.frontQrY}%`,
                      width: `${record.frontQrSize || DEFAULT_FRONT_QR_SIZE}%`,
                      aspectRatio: '1 / 1',
                    }}
                    className="z-10"
                    title={`Validação Oficial: ${record.code}`}
                  >
                    <QrCodeConferencia valor={publicValidationUrl} className="block w-full h-full" />
                  </div>
                )}
              </CertificateArtFrame>
            ) : (
              <FallbackFront record={record} publicValidationUrl={publicValidationUrl} />
            )}
          </div>
        </div>

        {/* PÁGINA 2: VERSO OFICIAL COM CARIMBO DIGITAL */}
        <div className="space-y-2">
          <div className="no-print flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-psi-vibrant" />
              Página 2 · Verso Oficial e Registro de Autenticidade
            </span>
            <span className="text-xs font-mono font-bold text-psi-deep">ID: {record.code}</span>
          </div>

          <div
            style={{ containerType: 'size' }}
            className="cert-page relative aspect-[1.414/1] w-full bg-white rounded-2xl md:rounded-3xl border border-line overflow-hidden shadow-card flex items-center justify-center"
          >
            {backImageUrl ? (
              <CertificateArtFrame src={backImageUrl} alt="Verso do Certificado">
                {stamp}
              </CertificateArtFrame>
            ) : (
              <div className="relative w-full h-full" style={{ containerType: 'inline-size' }}>
                <FallbackBack record={record} />
                {stamp}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Moldura do tamanho exato da arte dentro da página: as sobreposições (QR, carimbo)
 * são posicionadas em % dela, e não da página, para casar com o editor e o PDF
 * mesmo quando a proporção da arte difere da do papel.
 */
function CertificateArtFrame({ src, alt, children }: { src: string; alt: string; children?: ReactNode }) {
  const [ratio, setRatio] = useState(1.414);
  const imgRef = useRef<HTMLImageElement>(null);

  const readRatio = (img: HTMLImageElement | null) => {
    if (img?.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
  };

  // Imagem já carregada antes da hidratação não dispara `onLoad`.
  useEffect(() => {
    if (imgRef.current?.complete) readRatio(imgRef.current);
  }, [src]);

  return (
    <div
      className="relative"
      style={{
        aspectRatio: `${ratio}`,
        width: `min(100cqw, calc(100cqh * ${ratio}))`,
        containerType: 'inline-size',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        onLoad={(e) => readRatio(e.currentTarget)}
        className="absolute inset-0 w-full h-full"
      />
      {children}
    </div>
  );
}

/*
 * Frente e verso sem arte própria. Medidas em pt da página A4 paisagem do PDF,
 * convertidas para `cqw`: o preview escala igual ao papel e o que se vê é o que sai.
 */
const BRAND = CERTIFICATE_BRAND;
const cqw = (pt: number) => `${((pt / CERTIFICATE_PAGE_WIDTH) * 100).toFixed(3)}cqw`;
const CONTENT_LEFT = CERTIFICATE_BAND_WIDTH + 56;
const CONTENT_RIGHT_GAP = 54;
const LABEL_CLASS = 'font-extrabold uppercase text-[color:var(--cert-muted)]';

function BrandBand() {
  return (
    <>
      <svg
        aria-hidden
        className="absolute left-0 top-0 h-full"
        style={{ width: cqw(CERTIFICATE_BAND_WIDTH) }}
        viewBox={`0 0 ${CERTIFICATE_BAND_WIDTH} ${CERTIFICATE_PAGE_HEIGHT}`}
        preserveAspectRatio="none"
      >
        <rect width={CERTIFICATE_BAND_WIDTH} height={CERTIFICATE_PAGE_HEIGHT} fill={BRAND.primary} />
        {CERTIFICATE_BAND_SHAPES.map((shape) => (
          <path key={shape.d} d={shape.d} fill={shape.fill} fillOpacity={shape.opacity} />
        ))}
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logo-viver-mais-white.png"
        alt="Viver Mais Psicologia"
        className="absolute"
        style={{ left: cqw(30), top: cqw(40), width: cqw(146) }}
      />
    </>
  );
}

function Eyebrow({ children }: { children: string }) {
  return (
    <div className="absolute flex items-center" style={{ top: cqw(62), left: cqw(CONTENT_LEFT), gap: cqw(10) }}>
      <span style={{ width: cqw(22), height: cqw(3), background: BRAND.accent }} />
      <span
        className="font-extrabold uppercase"
        style={{ fontSize: cqw(8.5), letterSpacing: '0.26em', color: BRAND.primary }}
      >
        {children}
      </span>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={LABEL_CLASS} style={{ fontSize: cqw(7), letterSpacing: '0.2em' }}>{label}</p>
      <p className="font-semibold" style={{ fontSize: cqw(12), marginTop: cqw(4), color: BRAND.ink }}>{value}</p>
    </div>
  );
}

function certificateDuration(record: CertificateRecord): string {
  const minutes = record.certificateDurationMinutes;
  return (minutes ? formatCertificateDuration(minutes) : '') || record.durationHours;
}

function FallbackFront({ record, publicValidationUrl }: { record: CertificateRecord; publicValidationUrl: string }) {
  const parts = certificateBodyParts(record) ?? {
    lead: 'Certificamos oficialmente que',
    studentName: record.studentName,
    before: 'concluiu com aproveitamento e frequência integral o curso de extensão / formação profissional em',
    courseTitle: record.courseTitle,
    after: '.',
  };
  const online = record.certificateTextModel === 'online-course-with-instructor';
  const nameSize = parts.studentName.length > 40 ? 26 : parts.studentName.length > 28 ? 32 : 40;
  const validationHost = publicValidationUrl.replace(/^https?:\/\//, '');

  return (
    <div
      className="absolute inset-0 bg-white"
      style={{ fontFamily: 'var(--font-sans)', color: BRAND.ink, ['--cert-muted' as string]: BRAND.muted }}
    >
      <BrandBand />
      <Eyebrow>CERTIFICADO DE CONCLUSÃO</Eyebrow>

      <div className="absolute" style={{ left: cqw(CONTENT_LEFT), right: cqw(CONTENT_RIGHT_GAP), top: cqw(134) }}>
        <p style={{ fontSize: cqw(13), color: BRAND.muted }}>{parts.lead}</p>
        <h2
          className="font-display font-semibold"
          style={{ fontSize: cqw(nameSize), lineHeight: 1.15, marginTop: cqw(8), color: BRAND.ink }}
        >
          {parts.studentName}
        </h2>
        <div className="relative" style={{ marginTop: cqw(12), height: cqw(3) }}>
          <span className="absolute inset-x-0" style={{ top: cqw(1), height: 1, background: BRAND.line }} />
          <span className="absolute left-0 top-0" style={{ width: cqw(56), height: cqw(3), background: BRAND.accent }} />
        </div>
        <p style={{ fontSize: cqw(14), lineHeight: 1.75, marginTop: cqw(22) }}>
          {parts.before}{' '}
          <span className="font-semibold" style={{ color: BRAND.primary }}>{parts.courseTitle}</span>
          {parts.after}
        </p>
      </div>

      <div
        className="absolute grid"
        style={{
          left: cqw(CONTENT_LEFT), right: cqw(CONTENT_RIGHT_GAP), top: cqw(388),
          gridTemplateColumns: `repeat(${online ? 3 : 2}, 1fr)`, paddingTop: cqw(14), borderTop: `1px solid ${BRAND.line}`,
        }}
      >
        <Fact label={online ? 'Duração' : 'Carga horária'} value={certificateDuration(record)} />
        {online && <Fact label="Modalidade" value="Online" />}
        <Fact label="Emissão" value={record.issueDate} />
      </div>

      <div className="absolute" style={{ left: cqw(CONTENT_LEFT), top: cqw(486 + 36), width: cqw(190) }}>
        <div style={{ height: 1, background: BRAND.ink }} />
        <p className="font-semibold" style={{ fontSize: cqw(10.5), marginTop: cqw(7) }}>Dra. Viviane Jeremias</p>
        <p style={{ fontSize: cqw(8.5), marginTop: cqw(3), color: BRAND.muted, whiteSpace: 'nowrap' }}>
          Direção Acadêmica · Viver Mais Psicologia
        </p>
      </div>

      <div
        className="absolute flex items-start justify-end"
        style={{ right: cqw(CONTENT_RIGHT_GAP), top: cqw(482), gap: cqw(14) }}
      >
        <div className="text-right" style={{ paddingTop: cqw(12) }}>
          <p className={LABEL_CLASS} style={{ fontSize: cqw(7), letterSpacing: '0.2em' }}>Código de registro</p>
          <p className="font-semibold" style={{ fontSize: cqw(12), marginTop: cqw(3), color: BRAND.primary }}>{record.code}</p>
          <p style={{ fontSize: cqw(8), marginTop: cqw(6), color: BRAND.muted }}>Valide em {validationHost}</p>
        </div>
        <div style={{ width: cqw(66), height: cqw(66), border: `1px solid ${BRAND.line}`, background: '#fff' }}>
          <QrCodeConferencia valor={publicValidationUrl} className="block h-full w-full" />
        </div>
      </div>
    </div>
  );
}

function FallbackBack({ record }: { record: CertificateRecord }) {
  const online = record.certificateTextModel === 'online-course-with-instructor';
  const instructor = record.certificateInstructor?.trim();
  const rows: Array<[string, string]> = [
    ['Curso', record.courseTitle],
    ['Aluno(a)', record.studentName],
    [online ? 'Duração' : 'Carga horária', certificateDuration(record)],
  ];
  if (instructor) rows.push(['Ministrante', instructor]);
  if (online) rows.push(['Modalidade', 'Online']);
  rows.push(['Emitido em', record.issueDate], ['Código', record.code]);

  return (
    <div
      className="absolute inset-0 bg-white"
      style={{ fontFamily: 'var(--font-sans)', color: BRAND.ink, ['--cert-muted' as string]: BRAND.muted }}
    >
      <BrandBand />
      <Eyebrow>DOCUMENTO OFICIAL</Eyebrow>
      <h3
        className="absolute font-display font-semibold"
        style={{ left: cqw(CONTENT_LEFT), top: cqw(100), fontSize: cqw(28), lineHeight: 1.2 }}
      >
        Registro Acadêmico Oficial
      </h3>
      <dl
        className="absolute"
        style={{ left: cqw(CONTENT_LEFT), right: cqw(CONTENT_RIGHT_GAP), top: cqw(160), borderTop: `1px solid ${BRAND.line}` }}
      >
        {rows.map(([label, value]) => {
          const isCode = label === 'Código';
          return (
            <div
              key={label}
              className="grid"
              style={{
                gridTemplateColumns: cqw(118) + ' 1fr', padding: `${cqw(10)} 0`,
                borderBottom: `1px solid ${BRAND.line}`,
              }}
            >
              <dt className={LABEL_CLASS} style={{ fontSize: cqw(7), letterSpacing: '0.2em', paddingTop: cqw(3) }}>{label}</dt>
              <dd
                className={isCode ? 'font-extrabold' : 'font-semibold'}
                style={{ fontSize: cqw(11.5), lineHeight: 1.3, color: isCode ? BRAND.primary : BRAND.ink }}
              >
                {value}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

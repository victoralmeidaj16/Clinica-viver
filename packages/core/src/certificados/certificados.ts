/**
 * Módulo de Certificados de Cursos e Pós-Graduações (Viver Mais Psicologia).
 * Modelos puros e funções utilitárias compartilhadas entre o core e as aplicações.
 */

export type CertificateStatus = 'valid' | 'revoked' | 'cancelled';
export type CertificateStampQr = 'left' | 'top';
export type CertificateTextModel = 'standard' | 'online-course-with-instructor';

export const STAMP_WIDTH_MIN = 10;
export const STAMP_WIDTH_MAX = 90;
export const STAMP_TEXT_MAX = 2000;
export const STAMP_FONT_MIN = 2;
export const STAMP_FONT_MAX = 32;
/** Topo máximo do carimbo no verso (%): deixa descer até o fim, cortando o que passar. */
export const STAMP_Y_MAX = 98;
/**
 * Fonte do carimbo em milésimos da largura da arte: 11 = 1,1% da largura. Editor,
 * página pública e PDF medem tudo contra a arte, então o que se posiciona é o que sai.
 */
export const CERT_FONT_BASE_WIDTH = 1000;
/** Lado do QR do carimbo em múltiplos da fonte. */
export const STAMP_QR_FONT_RATIO = 7;
/** Altura de linha do texto do carimbo, em múltiplos da fonte. */
export const STAMP_LINE_HEIGHT = 1.25;

// Posições padrão de um certificado novo (ajustáveis no editor), em % da arte.
export const DEFAULT_FRONT_QR_X = 75.9;
export const DEFAULT_FRONT_QR_Y = 67.8;
export const DEFAULT_FRONT_QR_SIZE = 11.6;
export const DEFAULT_STAMP_X = 42.6;
export const DEFAULT_STAMP_Y = 88.2;
export const DEFAULT_STAMP_FONT_SIZE = 8;
export const DEFAULT_STAMP_WIDTH = 30;
export const DEFAULT_STAMP_ALIGN = 'center' as const;
export const DEFAULT_STAMP_QR: CertificateStampQr = 'left';
export const FRONT_QR_SIZE_MIN = 4;
export const FRONT_QR_SIZE_MAX = 25;

export interface CertificateRecord {
  id: string;
  code: string;
  institutionId?: string;
  studentId?: string;
  studentName: string;
  studentCpf?: string;
  studentEmail?: string;
  courseId?: string;
  courseTitle: string;
  certificateTextModel?: CertificateTextModel;
  certificateInstructor?: string;
  certificateDurationMinutes?: number;
  durationHours: string;
  issueDate: string;
  startDate?: string;
  completionDate?: string;
  signerInfo?: string;
  validationUrl?: string;
  status: CertificateStatus;
  revocationReason?: string;
  revokedAt?: string;
  revokedBy?: string;
  frontImageUrl?: string;
  backImageUrl?: string;
  /** Ativa ou desativa a exibição do QR de conferência na frente; padrão true quando coordenadas fornecidas */
  frontQrEnabled?: boolean;
  /** Posição horizontal do QR na frente (% a partir da esquerda) */
  frontQrX?: number;
  /** Posição vertical do QR na frente (% a partir do topo) */
  frontQrY?: number;
  /** Tamanho (largura/altura) do QR na frente em % da largura do documento */
  frontQrSize?: number;
  stampX?: number;
  stampY?: number;
  stampFontSize?: number;
  stampAlign?: 'left' | 'center' | 'right';
  /** Largura do carimbo em % da largura da página; ausente = ajusta ao texto. */
  stampWidth?: number;
  /** Texto livre do carimbo; ausente = texto gerado por `formatCertificateVersoText`. */
  stampText?: string;
  /** Posição do QR de conferência dentro do carimbo; ausente = sem QR. */
  stampQr?: CertificateStampQr;
  createdAt: string;
  createdBy?: string;
}

export function formatCertificateDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '';
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainingMinutes = rounded % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes} ${remainingMinutes === 1 ? 'minuto' : 'minutos'}`);
  return parts.join(' e ');
}

/** Frase do certificado em partes, para o layout dar destaque ao nome e ao curso. */
export interface CertificateBodyParts {
  lead: string;
  studentName: string;
  /** Texto entre o nome e o título do curso. */
  before: string;
  courseTitle: string;
  /** Texto depois do título do curso, até o ponto final. */
  after: string;
}

export function certificateBodyParts(record: CertificateRecord): CertificateBodyParts | null {
  if (record.certificateTextModel !== 'online-course-with-instructor') return null;
  const instructor = record.certificateInstructor?.trim();
  const duration = formatCertificateDuration(record.certificateDurationMinutes ?? 0);
  if (!instructor || !duration) return null;
  return {
    lead: 'Certificamos que',
    studentName: record.studentName,
    before: 'concluiu o curso',
    courseTitle: record.courseTitle,
    after: `, ministrado pela ${instructor}, promovido pela Viver Mais Psicologia, na modalidade online, com duração de ${duration}.`,
  };
}

/**
 * Cursos online com ministrante usam sempre o layout da marca: a arte gravada em
 * template ou no registro não se aplica a eles.
 */
export function certificateUsesBrandLayout(record: Pick<CertificateRecord, 'certificateTextModel'>): boolean {
  return record.certificateTextModel === 'online-course-with-instructor';
}

export function certificateBodyText(record: CertificateRecord): string | null {
  const parts = certificateBodyParts(record);
  if (!parts) return null;
  return `${parts.lead} ${parts.studentName} ${parts.before} ${parts.courseTitle}${parts.after}`;
}

/** Identidade visual dos certificados gerados sem arte (design.md da plataforma). */
export const CERTIFICATE_BRAND = {
  primary: '#5C397D',
  primaryDark: '#46285F',
  primaryLight: '#7E5BA6',
  accent: '#F99E29',
  capri: '#00C1FF',
  coral: '#E0484E',
  ink: '#241B30',
  muted: '#6B6275',
  soft: '#EFEAF3',
  line: '#E4DEEC',
} as const;

/** Faixa lateral do certificado sem arte: largura em pt sobre a página A4 paisagem (841,89 × 595,28). */
export const CERTIFICATE_BAND_WIDTH = 206;
export const CERTIFICATE_PAGE_WIDTH = 841.89;
export const CERTIFICATE_PAGE_HEIGHT = 595.28;

/** Formas da faixa (caminhos SVG no espaço da faixa), ecoando o símbolo da marca. */
export const CERTIFICATE_BAND_SHAPES: ReadonlyArray<{ d: string; fill: string; opacity: number }> = [
  { d: 'M 190 450 m -170 0 a 170 170 0 1 0 340 0 a 170 170 0 1 0 -340 0 Z', fill: '#7E5BA6', opacity: 0.5 },
  { d: 'M -10 372 L 126 478 L -10 560 Z', fill: '#F99E29', opacity: 1 },
  { d: 'M 150 392 m -23 0 a 23 23 0 1 0 46 0 a 23 23 0 1 0 -46 0 Z', fill: '#00C1FF', opacity: 1 },
  { d: 'M 36 595.28 A 78 78 0 0 1 192 595.28 Z', fill: '#E0484E', opacity: 1 },
];

export interface CertificateField {
  id: string;
  name: string;
  text: string;
  page: 1 | 2;
  xPct: number; // 0..100
  yPct: number; // 0..100
  fontPct: number;
  fontWeight: number; // 400..800
  color: string; // hex
  align: 'left' | 'center' | 'right';
  uppercase?: boolean;
  visible?: boolean;
}

export interface CertificateTemplate {
  id: string;
  courseId: string | null;
  name: string;
  backgroundUrl: string;
  backgroundType?: 'image' | 'pdf';
  secondBackgroundUrl?: string;
  secondBackgroundType?: 'image' | 'pdf';
  verificationUrl?: string;
  hoursOverride?: number;
  issueDateOverride?: string;
  widthPx: number;
  heightPx: number;
  fields: CertificateField[];
  updatedAt: string;
}

export const CERT_BASE_WIDTH = 1123;
export const CERT_BASE_HEIGHT = 794;

export const DEFAULT_SIGNER_INFO = 'VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153';
export const DEFAULT_VALIDATION_URL = 'www.vivermaispsicologia.com.br';

export function defaultCertificateFields(): CertificateField[] {
  return [
    {
      id: 'digital-signature',
      name: 'Assinatura digital e validação',
      text: `Para verificar a autenticidade deste certificado, escaneie o QR Code ao lado ou acesse o site vivermaispsicologia.com.br/validarcertificados
informando o código de validação: {{codigo_de_validacao}}`,
      xPct: 50,
      yPct: 95.5,
      page: 2,
      fontPct: 0.82,
      fontWeight: 500,
      color: '#111827',
      align: 'center',
    },
  ];
}

export function blankCertificateTemplate(
  courseId: string | null,
  name: string
): CertificateTemplate {
  return {
    id: courseId ?? 'default',
    courseId,
    name,
    backgroundUrl: '',
    verificationUrl: `https://${DEFAULT_VALIDATION_URL}`,
    widthPx: CERT_BASE_WIDTH,
    heightPx: CERT_BASE_HEIGHT,
    fields: defaultCertificateFields(),
    updatedAt: new Date().toISOString(),
  };
}

export function formatLongDate(dateInput: string): string {
  try {
    const d = new Date(dateInput.includes('T') ? dateInput : `${dateInput}T12:00:00Z`);
    if (isNaN(d.getTime())) return dateInput;
    return d.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateInput;
  }
}

export function formatCertificateVersoText(cert: {
  signerInfo?: string;
  durationHours: string;
  issueDate: string;
  validationUrl?: string;
  code: string;
}): string {
  return [
    'Para verificar a autenticidade deste certificado, escaneie o QR Code ao lado ou acesse o site vivermaispsicologia.com.br/validarcertificados',
    `informando o código de validação: ${cert.code}`,
  ].join('\n');
}

/** Texto que o carimbo exibe: o editado à mão, ou o gerado dos dados do certificado. */
export function resolveCertificateStampText(
  record: Pick<CertificateRecord, 'stampText' | 'signerInfo' | 'durationHours' | 'issueDate' | 'validationUrl' | 'code'>
): string {
  if (record.stampText && record.stampText.trim()) return record.stampText;
  return formatCertificateVersoText(record);
}

export const CERTIFICATE_QR_URL = 'https://vivermaispsicologia.com.br/validarcertificados';

/** Endereço público de conferência — o destino do QR impresso no certificado. */
export function certificatePublicValidationUrl(): string {
  return CERTIFICATE_QR_URL;
}

/** Normaliza os campos livres do carimbo vindos do formulário. */
export function sanitizeCertificateStamp(input: {
  stampWidth?: unknown;
  stampText?: unknown;
  stampQr?: unknown;
}): Pick<CertificateRecord, 'stampWidth' | 'stampText' | 'stampQr'> {
  const width = Number(input.stampWidth);
  const text = typeof input.stampText === 'string' ? input.stampText.replace(/\r\n/g, '\n').trim() : '';
  return {
    stampWidth:
      input.stampWidth != null && Number.isFinite(width)
        ? Math.round(Math.max(STAMP_WIDTH_MIN, Math.min(STAMP_WIDTH_MAX, width)) * 10) / 10
        : undefined,
    stampText: text ? text.slice(0, STAMP_TEXT_MAX) : undefined,
    stampQr: input.stampQr === 'left' || input.stampQr === 'top' ? input.stampQr : undefined,
  };
}

/** Normaliza os campos do QR da frente vindos do formulário. */
export function sanitizeFrontQr(input: {
  frontQrEnabled?: unknown;
  frontQrX?: unknown;
  frontQrY?: unknown;
  frontQrSize?: unknown;
}): Pick<CertificateRecord, 'frontQrEnabled' | 'frontQrX' | 'frontQrY' | 'frontQrSize'> {
  const enabled = input.frontQrEnabled === true || input.frontQrEnabled === 'true' || input.frontQrEnabled === 1;
  const x = Number(input.frontQrX);
  const y = Number(input.frontQrY);
  const size = Number(input.frontQrSize);

  return {
    frontQrEnabled: input.frontQrEnabled != null ? enabled : undefined,
    frontQrX:
      input.frontQrX != null && Number.isFinite(x)
        ? Math.round(Math.max(0, Math.min(100, x)) * 10) / 10
        : undefined,
    frontQrY:
      input.frontQrY != null && Number.isFinite(y)
        ? Math.round(Math.max(0, Math.min(100, y)) * 10) / 10
        : undefined,
    frontQrSize:
      input.frontQrSize != null && Number.isFinite(size)
        ? Math.round(Math.max(FRONT_QR_SIZE_MIN, Math.min(FRONT_QR_SIZE_MAX, size)) * 10) / 10
        : undefined,
  };
}

export function generateCertificateCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function renderCertificateText(
  text: string,
  record: Pick<
    CertificateRecord,
    'studentName' | 'courseTitle' | 'durationHours' | 'issueDate' | 'startDate' | 'completionDate' | 'code' | 'validationUrl'
  >,
  settings: {
    verificationUrl?: string;
    hoursOverride?: number;
    issueDateOverride?: string;
  } = {}
): string {
  const verificationUrl = settings.verificationUrl || record.validationUrl || `https://${DEFAULT_VALIDATION_URL}`;
  const hours = settings.hoursOverride ? `${settings.hoursOverride}` : record.durationHours.replace(/[^0-9]/g, '');
  const issueDate = settings.issueDateOverride
    ? formatLongDate(settings.issueDateOverride)
    : record.issueDate;

  const values: Record<string, string> = {
    '{{nome_do_aluno}}': record.studentName,
    '{{nome_do_curso}}': record.courseTitle,
    '{{data_de_inicio}}': record.startDate ? formatLongDate(record.startDate) : '—',
    '{{data_de_conclusao}}': record.completionDate ? formatLongDate(record.completionDate) : '—',
    '{{carga_horaria}}': hours,
    '{{data_de_emissao}}': issueDate,
    '{{link_de_validacao}}': verificationUrl,
    '{{codigo_de_validacao}}': record.code,
  };

  return Object.entries(values).reduce(
    (result, [token, value]) => result.split(token).join(value),
    text
  );
}

export const initialCertificates: CertificateRecord[] = [];

export function getMockCertificate(code: string): CertificateRecord | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return (
    initialCertificates.find(
      (c) => c.code.toLowerCase() === trimmed.toLowerCase() || c.id.toLowerCase() === trimmed.toLowerCase()
    ) || null
  );
}

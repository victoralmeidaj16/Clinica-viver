/**
 * Módulo de Certificados de Cursos e Pós-Graduações (Viver Mais Psicologia).
 * Modelos puros e funções utilitárias compartilhadas entre o core e as aplicações.
 */

export type CertificateStatus = 'valid' | 'revoked' | 'cancelled';
export type CertificateStampQr = 'left' | 'top';

export const STAMP_WIDTH_MIN = 10;
export const STAMP_WIDTH_MAX = 90;
export const STAMP_TEXT_MAX = 2000;

export interface CertificateRecord {
  id: string;
  code: string;
  studentId?: string;
  studentName: string;
  studentCpf?: string;
  studentEmail?: string;
  courseId?: string;
  courseTitle: string;
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
      text: `Assinado de forma digital por ${DEFAULT_SIGNER_INFO}
Duração e data: {{carga_horaria}}h, {{data_de_emissao}}. Para verificar autenticidade acesse: {{link_de_validacao}}
Vá na aba certificados e adicione o código: {{codigo_de_validacao}}`,
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
  const signer = cert.signerInfo || DEFAULT_SIGNER_INFO;
  const url = cert.validationUrl || DEFAULT_VALIDATION_URL;
  return [
    `Assinado de forma digital por ${signer}`,
    `Duração e data: ${cert.durationHours}, ${cert.issueDate}. Para verificar autenticidade acesse: ${url}`,
    `Vá na aba certificados e adicione o código: ${cert.code}`,
  ].join('\n');
}

/** Texto que o carimbo exibe: o editado à mão, ou o gerado dos dados do certificado. */
export function resolveCertificateStampText(
  record: Pick<CertificateRecord, 'stampText' | 'signerInfo' | 'durationHours' | 'issueDate' | 'validationUrl' | 'code'>
): string {
  if (record.stampText && record.stampText.trim()) return record.stampText;
  return formatCertificateVersoText(record);
}

/** Endereço público de conferência — o destino do QR impresso no carimbo. */
export function certificatePublicValidationUrl(code: string): string {
  return `https://${DEFAULT_VALIDATION_URL}/validar-certificado/${encodeURIComponent(code.trim())}`;
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

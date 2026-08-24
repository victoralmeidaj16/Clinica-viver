/**
 * Módulo de Certificados de Cursos e Pós-Graduações (Viver Mais Psicologia).
 * Modelos puros e funções utilitárias compartilhadas entre o core e as aplicações.
 */

export type CertificateStatus = 'valid' | 'revoked' | 'cancelled';

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

export const initialCertificates: CertificateRecord[] = [
  {
    id: 'yZV8anjS',
    code: 'yZV8anjS',
    studentId: 'u-aluno-1',
    studentName: 'Marina Silva Santos',
    courseTitle: 'Pós-Graduação em Psicoterapia Existencial e Fenomenológica',
    durationHours: '360h',
    issueDate: '05/03/2026',
    startDate: '2025-03-01',
    completionDate: '2026-03-01',
    signerInfo: DEFAULT_SIGNER_INFO,
    validationUrl: DEFAULT_VALIDATION_URL,
    status: 'valid',
    createdAt: '2026-03-05T14:30:00.000Z',
    createdBy: 'admin@viver.com',
  },
  {
    id: 'VVR-DEMO-2026',
    code: 'VVR-DEMO-2026',
    studentId: 'u-aluno-2',
    studentName: 'Carlos Eduardo Mendes',
    courseTitle: 'Formação Clínica em Manejo da Ansiedade e Pânico',
    durationHours: '120h',
    issueDate: '15/01/2026',
    startDate: '2025-10-01',
    completionDate: '2026-01-10',
    signerInfo: DEFAULT_SIGNER_INFO,
    validationUrl: DEFAULT_VALIDATION_URL,
    status: 'valid',
    createdAt: '2026-01-15T10:00:00.000Z',
    createdBy: 'admin@viver.com',
  },
  {
    id: 'REV-TEST-0001',
    code: 'REV-TEST-0001',
    studentId: 'u-aluno-3',
    studentName: 'Juliana Rocha',
    courseTitle: 'Introdução à Psicofarmacologia para Psicólogos',
    durationHours: '40h',
    issueDate: '10/02/2026',
    startDate: '2026-01-05',
    completionDate: '2026-02-08',
    signerInfo: DEFAULT_SIGNER_INFO,
    validationUrl: DEFAULT_VALIDATION_URL,
    status: 'revoked',
    revocationReason: 'Inadimplência contratual conforme cláusula 8.2 da Secretaria Acadêmica.',
    revokedAt: '2026-02-20T11:15:00.000Z',
    revokedBy: 'diretoria@viver.com',
    createdAt: '2026-02-10T09:00:00.000Z',
    createdBy: 'admin@viver.com',
  },
];

export function getMockCertificate(code: string): CertificateRecord | null {
  const trimmed = code.trim();
  if (!trimmed) return null;
  return (
    initialCertificates.find(
      (c) => c.code.toLowerCase() === trimmed.toLowerCase() || c.id.toLowerCase() === trimmed.toLowerCase()
    ) || null
  );
}

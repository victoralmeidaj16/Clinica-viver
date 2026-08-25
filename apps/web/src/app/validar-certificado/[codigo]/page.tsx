import type { Metadata } from 'next';
import { PublicCertificateValidation } from '@/components/certificados/PublicCertificateValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Validação de Certificado | Viver Mais Psicologia',
  robots: { index: false },
};

export default async function ValidarCertificadoPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const codeParam = decodeURIComponent(codigo).trim();
  return <PublicCertificateValidation code={codeParam} />;
}

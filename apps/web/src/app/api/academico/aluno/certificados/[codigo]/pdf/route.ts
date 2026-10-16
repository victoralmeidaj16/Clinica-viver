import { NextResponse } from 'next/server';
import { ApplicationError } from '@/server/application/http';
import { resolveStudentPortal, studentApiFailure } from '@/server/academic/studentApi';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  try {
    const [{ codigo }, { student, service }] = await Promise.all([params, resolveStudentPortal()]);
    const certificate = await service.getOwnedCertificate(student.id, decodeURIComponent(codigo));
    if (certificate.status !== 'valid') {
      throw new ApplicationError('CERTIFICATE_UNAVAILABLE', 'Este certificado não está disponível.', 403);
    }
    return NextResponse.redirect(
      new URL(`/api/public/certificados/${encodeURIComponent(certificate.code)}/pdf`, request.url),
    );
  } catch (error) {
    return studentApiFailure(error);
  }
}

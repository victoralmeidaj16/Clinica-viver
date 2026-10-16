import type { Metadata } from 'next';
import { StudentCertificates } from '@/components/academic/student/StudentCertificates';

export const metadata: Metadata = { title: 'Certificados | Portal do Aluno' };

export default function StudentCertificatesPage() {
  return <StudentCertificates />;
}

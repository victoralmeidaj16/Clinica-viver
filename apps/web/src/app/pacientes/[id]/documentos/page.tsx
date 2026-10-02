import { PatientDocuments } from '@/components/documents/PatientDocuments';

export default async function PatientDocumentsPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ atendimento?: string }>;
}) {
  const { id } = await params;
  const { atendimento } = await searchParams;
  return <PatientDocuments key={id} patientId={id} appointmentId={atendimento} />;
}

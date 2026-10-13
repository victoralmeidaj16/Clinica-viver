import type { Metadata } from 'next';
import { CourseDetail } from '@/components/academic/student/CourseDetail';

export const metadata: Metadata = { title: 'Curso | Portal do Aluno' };
export default async function StudentCoursePage({ params }: { params: Promise<{ cursoId: string }> }) {
  const { cursoId } = await params;
  return <CourseDetail courseId={cursoId} />;
}

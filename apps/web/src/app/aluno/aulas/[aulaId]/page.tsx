import type { Metadata } from 'next';
import { LessonPage } from '@/components/academic/student/VimeoLessonPlayer';

export const metadata: Metadata = { title: 'Aula | Portal do Aluno' };
export default async function StudentLessonPage({ params }: { params: Promise<{ aulaId: string }> }) {
  const { aulaId } = await params;
  return <LessonPage lessonId={aulaId} />;
}

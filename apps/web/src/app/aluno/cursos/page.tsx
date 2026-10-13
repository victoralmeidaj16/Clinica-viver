import type { Metadata } from 'next';
import { StudentCourses } from '@/components/academic/student/CourseGrid';

export const metadata: Metadata = { title: 'Cursos e aulas | Portal do Aluno' };
export default function StudentCoursesPage() { return <StudentCourses />; }

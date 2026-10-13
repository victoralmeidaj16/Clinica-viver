import type { Metadata } from 'next';
import { StudentLoginForm } from '@/components/academic/student/StudentLoginForm';

export const metadata: Metadata = { title: 'Portal do Aluno | Viver Mais' };
export default function StudentLoginPage() { return <StudentLoginForm />; }

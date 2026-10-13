import type { Metadata } from 'next';
import { StudentDashboard } from '@/components/academic/student/StudentDashboard';

export const metadata: Metadata = { title: 'Visão geral | Portal do Aluno' };
export default function StudentHomePage() { return <StudentDashboard />; }

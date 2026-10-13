import type { Metadata } from 'next';
import { StudentAccount } from '@/components/academic/student/StudentAccount';

export const metadata: Metadata = { title: 'Minha conta | Portal do Aluno' };
export default function StudentAccountPage() { return <StudentAccount />; }

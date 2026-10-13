import type { Metadata } from 'next';
import { ForcePasswordChange } from '@/components/academic/student/ForcePasswordChange';

export const metadata: Metadata = { title: 'Definir senha | Portal do Aluno' };
export default function StudentPasswordPage() { return <ForcePasswordChange />; }

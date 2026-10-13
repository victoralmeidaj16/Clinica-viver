import { StudentShell } from '@/components/academic/student/StudentShell';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <StudentShell>{children}</StudentShell>;
}

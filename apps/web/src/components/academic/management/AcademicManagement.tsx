'use client';

import { useState, type ComponentType } from 'react';
import { BookOpenText, GraduationCap, Sparkles, UsersRound } from 'lucide-react';
import { CoursesPanel } from './CoursesPanel';
import { EnrollmentsPanel } from './EnrollmentsPanel';
import { StudentsPanel } from './StudentsPanel';

type Tab = 'students' | 'courses' | 'enrollments';
const tabs: Array<{ id: Tab; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'students', label: 'Alunos', icon: UsersRound },
  { id: 'courses', label: 'Cursos e aulas', icon: BookOpenText },
  { id: 'enrollments', label: 'Matrículas', icon: GraduationCap },
];

export function AcademicManagement() {
  const [tab, setTab] = useState<Tab>('students');
  return <div className="space-y-6">
    <header className="relative overflow-hidden rounded-[2rem] bg-[#24152f] px-6 py-7 text-white shadow-contrast sm:px-8">
      <div className="absolute -right-8 -top-12 h-48 w-48 rounded-full border-[30px] border-[#c38cff]/15" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-2xl"><p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[.24em] text-[#e3c8ff]"><Sparkles className="h-3.5 w-3.5" />Núcleo acadêmico</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Área de Alunos</h1><p className="mt-3 text-sm leading-6 text-white/65">Contas, trilhas e matrículas organizadas num ambiente separado da operação clínica.</p></div><div className="rounded-2xl border border-white/10 bg-white/[.06] px-4 py-3 text-xs text-white/70"><strong className="block text-white">Conteúdo Vimeo</strong>Conclusão automática ao fim da aula</div></div>
    </header>
    <nav aria-label="Seções acadêmicas" className="flex gap-2 overflow-x-auto rounded-2xl border border-psi-soft bg-white p-2 shadow-soft">{tabs.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex min-w-max items-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${tab === id ? 'bg-psi-deep text-white shadow-lift' : 'text-muted hover:bg-psi-light hover:text-psi-darkest'}`}><Icon className="h-4 w-4" />{label}</button>)}</nav>
    {tab === 'students' ? <StudentsPanel /> : tab === 'courses' ? <CoursesPanel /> : <EnrollmentsPanel />}
  </div>;
}

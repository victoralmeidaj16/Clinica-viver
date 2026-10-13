'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, BookOpenCheck, Sparkles } from 'lucide-react';
import type { StudentDashboard as DashboardData, StudentCourseView } from '@/server/academic/studentPortalService';
import { CourseGrid } from './CourseGrid';

export function StudentDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/academico/aluno/inicio', { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível carregar sua visão geral.'); return payload.data;
    }).then((next) => { if (!cancelled) setData(next); }).catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, []);
  if (error) return <ErrorState message={error} />;
  if (!data) return <LoadingState />;
  return <StudentDashboardView studentName={data.student.fullName} courses={data.courses} />;
}

export function StudentDashboardView({ studentName, courses }: { studentName: string; courses: StudentCourseView[] }) {
  const next = courses.find((course) => course.nextLesson)?.nextLesson;
  return <div className="space-y-9"><header className="grid gap-5 rounded-[2rem] bg-psi-darkest p-6 text-white shadow-xl shadow-psi-darkest/10 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Visão geral</p><h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold sm:text-5xl">Olá, {studentName.split(' ')[0]}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-white/55">Seu aprendizado continua de onde você parou. Um passo de cada vez, no seu ritmo.</p></div><span className="hidden h-20 w-20 place-items-center rounded-full border border-white/10 bg-white/5 lg:grid"><Sparkles className="h-7 w-7 text-psi-vibrant" /></span></header>
    {next && <section className="flex flex-col gap-5 rounded-[1.6rem] border border-psi-darkest/10 bg-[#e6d8ef] p-6 sm:flex-row sm:items-center"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-psi-deep shadow-sm"><BookOpenCheck className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">Continuar estudando</p><h2 className="mt-1 truncate text-lg font-black">{next.title}</h2></div><Link href={`/aluno/aulas/${next.id}`} className="flex items-center justify-center gap-2 rounded-xl bg-psi-deep px-5 py-3 text-xs font-black text-white">Abrir aula<ArrowRight className="h-4 w-4" /></Link></section>}
    <section><div className="mb-5 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-psi-vibrant">Sua biblioteca</p><h2 className="mt-1 font-[var(--font-display)] text-3xl font-semibold">Cursos em andamento</h2></div>{courses.length > 0 && <Link href="/aluno/cursos" className="hidden text-xs font-black text-psi-deep sm:block">Ver todos</Link>}</div><CourseGrid courses={courses} /></section>
  </div>;
}

function LoadingState() { return <div className="space-y-5 animate-pulse"><div className="h-56 rounded-[2rem] bg-psi-soft" /><div className="grid gap-5 md:grid-cols-3"><div className="h-72 rounded-3xl bg-white/70" /><div className="h-72 rounded-3xl bg-white/70" /></div></div>; }
function ErrorState({ message }: { message: string }) { return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center"><h1 className="font-black text-rose-900">Não foi possível carregar o portal</h1><p className="mt-2 text-sm text-rose-700">{message}</p></div>; }

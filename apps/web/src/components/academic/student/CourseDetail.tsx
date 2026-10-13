'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Clock3, PlayCircle } from 'lucide-react';
import type { StudentCourseView } from '@/server/academic/studentPortalService';
import { Progress } from './CourseGrid';

export function CourseDetail({ courseId }: { courseId: string }) {
  const [course, setCourse] = useState<StudentCourseView | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/academico/aluno/cursos/${courseId}`, { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Curso indisponível.'); return payload.data;
    }).then((data) => { if (!cancelled) setCourse(data); }).catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, [courseId]);
  if (error) return <div className="rounded-3xl bg-rose-50 p-8 text-center text-sm font-bold text-rose-800">{error}</div>;
  if (!course) return <div className="h-96 animate-pulse rounded-[2rem] bg-white/60" />;
  return <CourseDetailView course={course} />;
}

export function CourseDetailView({ course }: { course: StudentCourseView }) {
  const lessonCount = course.modules.reduce((sum, item) => sum + item.lessons.length, 0);
  return <div className="space-y-7"><Link href="/aluno/cursos" className="inline-flex items-center gap-2 text-xs font-black text-muted hover:text-psi-deep"><ArrowLeft className="h-4 w-4" />Voltar aos cursos</Link>
    <header className="relative overflow-hidden rounded-[2rem] bg-psi-darkest p-7 text-white sm:p-10"><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full border border-white/10" /><div className="relative max-w-3xl"><p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Trilha de aprendizagem</p><h1 className="mt-4 font-[var(--font-display)] text-4xl font-semibold leading-tight sm:text-5xl">{course.title}</h1><p className="mt-4 max-w-2xl text-sm leading-6 text-white/55">{course.description}</p><div className="mt-7 max-w-md"><Progress progress={course.progress} /></div></div></header>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]"><section className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-[var(--font-display)] text-3xl font-semibold">Conteúdo do curso</h2><span className="text-xs font-bold text-muted">{lessonCount} aulas</span></div>
      {lessonCount === 0 ? <div className="rounded-3xl border border-dashed border-psi-darkest/15 bg-white/50 p-10 text-center"><BookOpen className="mx-auto h-7 w-7 text-psi-deep" /><p className="mt-3 text-sm font-bold">Ainda não há aulas publicadas.</p></div> : course.modules.map((module) => <article key={module.id} className="overflow-hidden rounded-3xl border border-psi-darkest/10 bg-white"><header className="border-b border-psi-darkest/10 bg-psi-soft/45 px-5 py-4"><p className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">Módulo {module.position}</p><h3 className="mt-1 text-base font-black">{module.title}</h3></header><div className="divide-y divide-psi-darkest/10">{module.lessons.map((lesson, index) => <Link key={lesson.id} href={`/aluno/aulas/${lesson.id}`} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-[#f8f3ec]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-psi-darkest/10 text-[11px] font-black group-hover:bg-psi-deep group-hover:text-white">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black">{lesson.title}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted"><Clock3 className="h-3 w-3" />{lesson.durationMinutes} min</p></div><PlayCircle className="h-5 w-5 text-psi-vibrant" /></Link>)}</div></article>)}</section>
      <aside>{course.nextLesson ? <div className="sticky top-7 rounded-3xl bg-[#e6d8ef] p-5"><p className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">Próxima aula</p><h3 className="mt-2 text-base font-black">{course.nextLesson.title}</h3><Link href={`/aluno/aulas/${course.nextLesson.id}`} className="mt-5 flex items-center justify-between rounded-xl bg-psi-deep px-4 py-3 text-xs font-black text-white">Continuar<ArrowRight className="h-4 w-4" /></Link></div> : <div className="rounded-3xl bg-emerald-100 p-5 text-emerald-950"><p className="text-[10px] font-black uppercase tracking-wider">Percurso concluído</p><p className="mt-2 text-sm leading-5">Você chegou ao fim das aulas disponíveis.</p></div>}</aside>
    </div>
  </div>;
}

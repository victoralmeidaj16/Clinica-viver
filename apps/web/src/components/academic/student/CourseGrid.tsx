'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, PlayCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { StudentCourseView } from '@/server/academic/studentPortalService';

export function StudentCourses() {
  const [courses, setCourses] = useState<StudentCourseView[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch('/api/academico/aluno/cursos', { cache: 'no-store' }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Não foi possível carregar os cursos.'); return payload.data; }).then((data) => { if (!cancelled) setCourses(data); }).catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, []);
  return <div className="space-y-7"><header><p className="text-[10px] font-black uppercase tracking-[.2em] text-psi-vibrant">Biblioteca</p><h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold sm:text-5xl">Cursos e aulas</h1><p className="mt-3 text-sm text-muted">Todo o conteúdo liberado para sua conta.</p></header>{error ? <p className="rounded-2xl bg-rose-50 p-5 text-sm font-bold text-rose-800">{error}</p> : courses ? <CourseGrid courses={courses} /> : <div className="h-72 animate-pulse rounded-3xl bg-white/60" />}</div>;
}

export function CourseGrid({ courses }: { courses: StudentCourseView[] }) {
  if (courses.length === 0) return <div className="rounded-[2rem] border border-dashed border-psi-darkest/15 bg-white/45 px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-psi-deep shadow-sm"><BookOpen className="h-6 w-6" /></span><h2 className="mt-5 font-[var(--font-display)] text-2xl font-semibold">Nenhum curso liberado</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Quando a gestão fizer sua matrícula, o curso aparecerá aqui automaticamente.</p></div>;
  return <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{courses.map((course, index) => <article key={course.id} className="group overflow-hidden rounded-[1.6rem] border border-psi-darkest/10 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-psi-darkest/5">
    <div className="relative h-40 overflow-hidden bg-psi-darkest p-5 text-white"><div className="absolute inset-0 opacity-25" style={course.coverUrl ? { backgroundImage: `url(${course.coverUrl})`, backgroundPosition: 'center', backgroundSize: 'cover' } : undefined} /><div className="absolute -right-10 -top-16 h-52 w-52 rounded-full border border-white/10" /><span className="relative text-[10px] font-black uppercase tracking-[.18em] text-psi-vibrant">Curso {String(index + 1).padStart(2, '0')}</span><h2 className="relative mt-4 line-clamp-2 font-[var(--font-display)] text-2xl font-semibold leading-tight">{course.title}</h2></div>
    <div className="p-5"><p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted">{course.description || 'Conteúdo preparado para sua formação.'}</p><Progress progress={course.progress} /><Link href={course.nextLesson ? `/aluno/aulas/${course.nextLesson.id}` : `/aluno/cursos/${course.id}`} className="mt-5 flex items-center justify-between border-t border-psi-darkest/10 pt-4 text-xs font-black text-psi-deep"><span className="flex items-center gap-2"><PlayCircle className="h-4 w-4" />{course.nextLesson ? 'Continuar estudando' : 'Ver conteúdo'}</span><ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link></div>
  </article>)}</div>;
}

export function Progress({ progress }: { progress: StudentCourseView['progress'] }) { return <div className="mt-5"><div className="mb-2 flex justify-between text-[11px] font-black"><span>{progress.completed} de {progress.total} aulas</span><span className="text-psi-vibrant">{progress.percentage}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-psi-soft"><div className="h-full rounded-full bg-psi-vibrant" style={{ width: `${progress.percentage}%` }} /></div></div>; }

'use client';

import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Clock3, Eye, EyeOff, Pencil } from 'lucide-react';
import type { AcademicCourse, AcademicCourseTree } from '@thats-life/core';
import { CourseEditor } from './CourseEditor';
import { LessonEditor } from './LessonEditor';
import { ModuleEditor } from './ModuleEditor';
import { errorMessage, lessonVimeoInput, sendJson } from './managementRequest';

export function CoursesPanel() {
  const [courses, setCourses] = useState<AcademicCourse[]>([]);
  const [selected, setSelected] = useState<AcademicCourseTree | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const loadCourses = useCallback(async () => {
    const response = await fetch('/api/academico/gestao/cursos', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok) return setError(payload.error?.message ?? 'Falha ao carregar cursos.');
    setCourses(payload.data ?? []);
  }, []);
  const loadCourse = useCallback(async (id: string) => {
    const response = await fetch(`/api/academico/gestao/cursos/${id}`, { cache: 'no-store' });
    const payload = await response.json();
    if (response.ok) setSelected(payload.data);
  }, []);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/academico/gestao/cursos', { cache: 'no-store' })
      .then(async (response) => ({ response, payload: await response.json() }))
      .then(({ response, payload }) => {
        if (cancelled) return;
        if (!response.ok) setError(payload.error?.message ?? 'Falha ao carregar cursos.');
        else setCourses(payload.data ?? []);
      })
      .catch(() => { if (!cancelled) setError('Falha ao carregar cursos.'); });
    return () => { cancelled = true; };
  }, []);

  async function swap<T extends { id: string; position: number }>(kind: 'module' | 'lesson', current: T, neighbor?: T) {
    if (!neighbor || !selected) return;
    const endpoint = (id: string) => kind === 'module' ? `/api/academico/gestao/modulos/${id}` : `/api/academico/gestao/aulas/${id}`;
    const body = (item: T, position: number) => ({
      ...item,
      position,
      ...(kind === 'lesson' && 'vimeoId' in item ? { vimeoUrl: lessonVimeoInput(item as unknown as Parameters<typeof lessonVimeoInput>[0]) } : {}),
    });
    try {
      setError('');
      await sendJson(endpoint(current.id), 'PATCH', body(current, neighbor.position));
      await sendJson(endpoint(neighbor.id), 'PATCH', body(neighbor, current.position));
    } catch (cause) { setError(`Não foi possível reordenar: ${errorMessage(cause)}`); }
    await loadCourse(selected.id);
  }
  const reload = () => { setEditing(null); if (selected) void loadCourse(selected.id); };

  return <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
    <aside className="rounded-3xl border border-psi-soft bg-psi-darkest p-4 text-white shadow-contrast">
      <p className="px-2 text-[10px] font-black uppercase tracking-[.2em] text-psi-soft/60">Biblioteca</p>
      <div className="mt-3 space-y-2">{courses.map((course) => <button key={course.id} onClick={() => void loadCourse(course.id)} className={`w-full rounded-2xl border p-3 text-left transition ${selected?.id === course.id ? 'border-psi-vibrant bg-white/15' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}><span className="flex items-start gap-2"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-psi-vibrant" /><span className="min-w-0"><strong className="block text-xs leading-5">{course.title}</strong><span className="mt-1 flex items-center gap-1 text-[10px] text-white/55">{course.published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}{course.published ? 'Publicado' : 'Rascunho'}</span></span></span></button>)}</div>
      {courses.length === 0 && <p className="p-4 text-xs text-white/50">Nenhum curso cadastrado.</p>}
    </aside>
    <section className="min-w-0 rounded-3xl border border-psi-soft bg-white p-5 shadow-soft">
      {error && <p className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      {!selected ? <div className="grid min-h-80 place-items-center text-center"><div><BookOpen className="mx-auto h-10 w-10 text-psi-soft" /><h2 className="mt-3 font-black text-psi-darkest">Selecione um curso</h2><p className="mt-1 text-xs text-muted">Organize módulos e aulas na sequência de estudo.</p></div></div> : <div>
        <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">Grade do curso</p><h2 className="mt-1 text-xl font-black text-psi-darkest">{selected.title}</h2></div><span className="rounded-full bg-psi-light px-3 py-1 text-[10px] font-black text-psi-deep">{selected.modules.reduce((sum, module) => sum + module.lessons.length, 0)} aulas</span></div>
        <div className="mt-5 space-y-4">{selected.modules.map((module, moduleIndex) => <article key={module.id} className="rounded-2xl border border-psi-soft p-4"><div className="flex items-center gap-2"><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase text-muted">Módulo {module.position}</p><h3 className="truncate text-sm font-black text-psi-darkest">{module.title}</h3></div><EditButton label="Renomear módulo" onClick={() => setEditing(editing === module.id ? null : module.id)} /><OrderButtons onUp={() => void swap('module', module, selected.modules[moduleIndex - 1])} onDown={() => void swap('module', module, selected.modules[moduleIndex + 1])} /></div>
          {editing === module.id && <div className="mt-3"><ModuleEditor key={module.id} courseId={selected.id} nextPosition={module.position} module={module} onSaved={reload} onCancel={() => setEditing(null)} /></div>}
          <div className="mt-3 space-y-2">{module.lessons.map((lesson, lessonIndex) => <div key={lesson.id}><div className="flex items-center gap-3 rounded-xl bg-psi-light px-3 py-2.5"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[10px] font-black text-psi-deep">{lesson.position}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-black text-psi-darkest">{lesson.title}</p><p className="flex items-center gap-1 text-[10px] text-muted"><Clock3 className="h-3 w-3" />{lesson.durationMinutes} min · {lesson.published ? 'Publicada' : 'Rascunho'}</p></div><EditButton label="Editar aula" onClick={() => setEditing(editing === lesson.id ? null : lesson.id)} /><OrderButtons onUp={() => void swap('lesson', lesson, module.lessons[lessonIndex - 1])} onDown={() => void swap('lesson', lesson, module.lessons[lessonIndex + 1])} /></div>{editing === lesson.id && <LessonEditor key={lesson.id} courseId={selected.id} moduleId={module.id} modulePosition={module.position} lesson={lesson} onSaved={reload} onCancel={() => setEditing(null)} />}</div>)}</div>
          <LessonEditor courseId={selected.id} moduleId={module.id} modulePosition={module.position} nextPosition={module.lessons.length + 1} onSaved={() => void loadCourse(selected.id)} />
        </article>)}</div>
        <div className="mt-4"><ModuleEditor courseId={selected.id} nextPosition={selected.modules.length + 1} onSaved={() => void loadCourse(selected.id)} /></div>
      </div>}
    </section>
    <CourseEditor key={selected?.id ?? 'new'} course={selected ?? undefined} onSaved={() => { void loadCourses(); if (selected) void loadCourse(selected.id); }} />
  </div>;
}

function OrderButtons({ onUp, onDown }: { onUp: () => void; onDown: () => void }) { return <span className="flex shrink-0 gap-1"><button onClick={onUp} className="rounded-lg border border-psi-soft bg-white p-1.5" title="Mover para cima"><ChevronUp className="h-3 w-3" /></button><button onClick={onDown} className="rounded-lg border border-psi-soft bg-white p-1.5" title="Mover para baixo"><ChevronDown className="h-3 w-3" /></button></span>; }
function EditButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="shrink-0 rounded-lg border border-psi-soft bg-white p-1.5 text-psi-deep" title={label} aria-label={label}><Pencil className="h-3 w-3" /></button>; }

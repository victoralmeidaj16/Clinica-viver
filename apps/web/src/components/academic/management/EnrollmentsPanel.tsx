'use client';

import { useEffect, useState } from 'react';
import { GraduationCap, Link2 } from 'lucide-react';
import type { AcademicCourse, AcademicEnrollment, AcademicStudent } from '@thats-life/core';

export function EnrollmentsPanel() {
  const [students, setStudents] = useState<AcademicStudent[]>([]);
  const [courses, setCourses] = useState<AcademicCourse[]>([]);
  const [enrollments, setEnrollments] = useState<AcademicEnrollment[]>([]);
  const [studentId, setStudentId] = useState('');
  const [courseId, setCourseId] = useState('');
  const [message, setMessage] = useState('');

  async function load() {
    const [studentsResponse, coursesResponse, enrollmentsResponse] = await Promise.all([
      fetch('/api/academico/gestao/alunos', { cache: 'no-store' }),
      fetch('/api/academico/gestao/cursos', { cache: 'no-store' }),
      fetch('/api/academico/gestao/matriculas', { cache: 'no-store' }),
    ]);
    const [studentPayload, coursePayload, enrollmentPayload] = await Promise.all([studentsResponse.json(), coursesResponse.json(), enrollmentsResponse.json()]);
    setStudents(studentPayload.data ?? []); setCourses(coursePayload.data ?? []); setEnrollments(enrollmentPayload.data ?? []);
  }
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/academico/gestao/alunos', { cache: 'no-store' }),
      fetch('/api/academico/gestao/cursos', { cache: 'no-store' }),
      fetch('/api/academico/gestao/matriculas', { cache: 'no-store' }),
    ]).then(async (responses) => Promise.all(responses.map((response) => response.json())))
      .then(([studentPayload, coursePayload, enrollmentPayload]) => {
        if (cancelled) return;
        setStudents(studentPayload.data ?? []);
        setCourses(coursePayload.data ?? []);
        setEnrollments(enrollmentPayload.data ?? []);
      });
    return () => { cancelled = true; };
  }, []);

  async function enroll() {
    const response = await fetch('/api/academico/gestao/matriculas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId, courseId, status: 'active' }) });
    setMessage(response.ok ? 'Matrícula ativada.' : 'Não foi possível criar a matrícula.');
    if (response.ok) await load();
  }
  async function toggle(enrollment: AcademicEnrollment) {
    await fetch(`/api/academico/gestao/matriculas/${enrollment.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: enrollment.status === 'active' ? 'suspended' : 'active' }) });
    await load();
  }
  const studentName = (id: string) => students.find((student) => student.id === id)?.fullName ?? 'Aluno';
  const courseName = (id: string) => courses.find((course) => course.id === id)?.title ?? 'Curso';

  return <div className="space-y-6"><section className="rounded-3xl border border-psi-soft bg-white p-5 shadow-soft sm:p-6"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-800"><Link2 className="h-5 w-5" /></span><div><h2 className="text-lg font-black text-psi-darkest">Nova matrícula</h2><p className="text-xs text-muted">Vincule o aluno ao conteúdo liberado.</p></div></div><div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]"><Select value={studentId} onChange={setStudentId} label="Aluno" options={students.map((item) => ({ value: item.id, label: item.fullName }))} /><Select value={courseId} onChange={setCourseId} label="Curso" options={courses.map((item) => ({ value: item.id, label: item.title }))} /><button disabled={!studentId || !courseId} onClick={() => void enroll()} className="self-end rounded-xl bg-psi-deep px-5 py-3 text-xs font-black text-white disabled:opacity-40">Matricular</button></div>{message && <p className="mt-3 text-xs font-bold text-psi-deep">{message}</p>}</section>
    <section className="rounded-3xl border border-psi-soft bg-white p-5 shadow-soft sm:p-6"><h2 className="text-lg font-black text-psi-darkest">Matrículas atuais</h2><div className="mt-4 grid gap-3 lg:grid-cols-2">{enrollments.map((enrollment) => <article key={enrollment.id} className="flex items-center gap-3 rounded-2xl border border-psi-soft bg-psi-light p-4"><GraduationCap className="h-5 w-5 shrink-0 text-psi-deep" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-psi-darkest">{studentName(enrollment.studentId)}</p><p className="truncate text-xs text-muted">{courseName(enrollment.courseId)}</p></div><button onClick={() => void toggle(enrollment)} className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${enrollment.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>{enrollment.status === 'active' ? 'Ativa' : 'Suspensa'}</button></article>)}</div>{enrollments.length === 0 && <p className="mt-4 rounded-2xl border border-dashed border-psi-soft p-8 text-center text-sm text-muted">Nenhuma matrícula criada.</p>}</section>
  </div>;
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label><span className="mb-1 block text-xs font-black text-psi-darkest">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-xl border border-psi-soft bg-psi-light px-3 py-3 text-sm"><option value="">Selecione…</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }

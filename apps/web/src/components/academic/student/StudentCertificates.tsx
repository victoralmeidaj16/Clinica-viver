'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Award, BookOpenCheck, Download, ExternalLink, LockKeyhole, ShieldCheck } from 'lucide-react';
import type { StudentCertificateSummary, StudentCourseView } from '@/server/academic/studentPortalService';

type CertificatePageData = { certificates: StudentCertificateSummary[]; courses: StudentCourseView[] };

export function StudentCertificates() {
  const [data, setData] = useState<CertificatePageData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch('/api/academico/aluno/certificados', { cache: 'no-store' }),
      fetch('/api/academico/aluno/cursos', { cache: 'no-store' }),
    ]).then(async ([certificatesResponse, coursesResponse]) => {
      const [certificatesPayload, coursesPayload] = await Promise.all([certificatesResponse.json(), coursesResponse.json()]);
      if (!certificatesResponse.ok) throw new Error(certificatesPayload.error?.message ?? 'Não foi possível carregar os certificados.');
      if (!coursesResponse.ok) throw new Error(coursesPayload.error?.message ?? 'Não foi possível carregar o progresso.');
      return { certificates: certificatesPayload.data, courses: coursesPayload.data };
    }).then((next) => { if (!cancelled) setData(next); })
      .catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-7 text-rose-900"><p className="font-black">Não foi possível abrir seus certificados</p><p className="mt-2 text-sm text-rose-700">{error}</p></div>;
  if (!data) return <div className="space-y-5 animate-pulse"><div className="h-56 rounded-[2rem] bg-psi-soft" /><div className="h-64 rounded-[2rem] bg-white/60" /></div>;
  return <StudentCertificatesView {...data} />;
}

export function StudentCertificatesView({ certificates, courses }: CertificatePageData) {
  const certifiedCourseIds = new Set(certificates.map((certificate) => certificate.courseId).filter(Boolean));
  const legacyCourseTitles = new Set(certificates.filter((certificate) => !certificate.courseId).map((certificate) => certificate.courseTitle));
  const pending = courses.filter((course) => !certifiedCourseIds.has(course.id) && !legacyCourseTitles.has(course.title));

  return <div className="space-y-8">
    <header className="relative overflow-hidden rounded-[2rem] bg-psi-darkest px-6 py-8 text-white shadow-xl shadow-psi-darkest/10 sm:px-9 sm:py-10">
      <div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border border-white/10" />
      <div className="absolute right-8 top-8 hidden h-24 w-24 rotate-6 place-items-center rounded-2xl border border-white/10 bg-white/5 sm:grid"><Award className="h-10 w-10 text-psi-vibrant" /></div>
      <p className="text-[10px] font-black uppercase tracking-[.22em] text-psi-vibrant">Arquivo acadêmico</p>
      <h1 className="mt-3 font-[var(--font-display)] text-4xl font-semibold sm:text-5xl">Seus certificados</h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-white/55">Documentos oficiais liberados automaticamente quando você conclui todas as aulas publicadas do curso.</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/65"><ShieldCheck className="h-3.5 w-3.5 text-emerald-300" />Validação pública por código e QR Code</div>
    </header>

    {certificates.length > 0 && <section><SectionTitle eyebrow="Disponíveis" title="Documentos emitidos" /><div className="grid gap-5 lg:grid-cols-2">{certificates.map((certificate) => <CertificateCard key={certificate.code} certificate={certificate} />)}</div></section>}

    {pending.length > 0 && <section><SectionTitle eyebrow="Em andamento" title="Próximas conquistas" /><div className="grid gap-4 md:grid-cols-2">{pending.map((course) => <article key={course.id} className="rounded-3xl border border-psi-darkest/10 bg-white/65 p-5"><div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-psi-soft text-psi-deep"><LockKeyhole className="h-4 w-4" /></span><div className="min-w-0 flex-1"><h3 className="font-black">{course.title}</h3><p className="mt-1 text-xs text-muted">Conclua todas as aulas para liberar o certificado.</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-psi-soft"><div className="h-full rounded-full bg-psi-vibrant" style={{ width: `${course.progress.percentage}%` }} /></div><p className="mt-2 text-[11px] font-black text-psi-deep">{course.progress.percentage}% concluído</p></div></div></article>)}</div></section>}

    {certificates.length === 0 && pending.length === 0 && <div className="rounded-[2rem] border border-dashed border-psi-darkest/15 bg-white/45 px-6 py-16 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white text-psi-deep shadow-sm"><BookOpenCheck className="h-6 w-6" /></span><h2 className="mt-5 font-[var(--font-display)] text-2xl font-semibold">Nenhum certificado disponível</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">Quando você estiver matriculado e concluir um curso, o documento aparecerá aqui automaticamente.</p></div>}
  </div>;
}

function CertificateCard({ certificate }: { certificate: StudentCertificateSummary }) {
  const available = certificate.status === 'valid';
  return <article className="group relative overflow-hidden rounded-[1.7rem] border border-psi-darkest/10 bg-white p-6 shadow-sm"><div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-psi-deep via-psi-vibrant to-[#d8b46a]" /><div className="flex items-start justify-between gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f0e7c9] text-[#80611f]"><Award className="h-5 w-5" /></span><span className={`rounded-full px-3 py-1 text-[9px] font-black uppercase tracking-[.16em] ${available ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>{available ? 'Documento válido' : 'Indisponível'}</span></div><h3 className="mt-5 font-[var(--font-display)] text-2xl font-semibold leading-tight">{certificate.courseTitle}</h3><div className="mt-5 grid grid-cols-2 gap-3 border-y border-psi-darkest/10 py-4 text-xs"><div><p className="text-[9px] font-black uppercase tracking-wider text-muted">Carga horária</p><p className="mt-1 font-black">{certificate.durationHours}</p></div><div><p className="text-[9px] font-black uppercase tracking-wider text-muted">Código oficial</p><p className="mt-1 truncate font-mono font-bold text-psi-deep">{certificate.code}</p></div></div>{available && <div className="mt-5 flex flex-col gap-2 sm:flex-row"><a href={`/api/academico/aluno/certificados/${encodeURIComponent(certificate.code)}/pdf`} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-psi-deep px-4 py-3 text-xs font-black text-white"><Download className="h-4 w-4" />Baixar PDF</a><Link href={`/validar-certificado/${encodeURIComponent(certificate.code)}`} target="_blank" className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-psi-darkest/15 px-4 py-3 text-xs font-black text-psi-deep"><ExternalLink className="h-4 w-4" />Validar autenticidade</Link></div>}</article>;
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.18em] text-psi-vibrant">{eyebrow}</p><h2 className="mt-1 font-[var(--font-display)] text-3xl font-semibold">{title}</h2></div>;
}

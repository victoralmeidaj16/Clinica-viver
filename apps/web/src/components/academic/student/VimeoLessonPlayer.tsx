'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, RefreshCw } from 'lucide-react';
import type { AcademicCourse, AcademicLesson, AcademicModule } from '@thats-life/core';
import { bindVimeoEnded, createCompletionHandler, type VimeoPlayerPort } from './vimeoPlayer';

declare global { interface Window { Vimeo?: { Player: new (element: HTMLIFrameElement) => VimeoPlayerPort } } }
let playerScript: Promise<void> | null = null;
function loadVimeoScript() {
  if (window.Vimeo) return Promise.resolve();
  if (playerScript) return playerScript;
  playerScript = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://player.vimeo.com/api/player.js'; script.async = true;
    script.onload = () => resolve(); script.onerror = () => reject(new Error('Não foi possível carregar o player Vimeo.')); document.head.appendChild(script);
  });
  return playerScript;
}

type LessonPayload = { course: AcademicCourse; module: AcademicModule; lesson: AcademicLesson; completed: boolean };

export function LessonPage({ lessonId }: { lessonId: string }) {
  const [data, setData] = useState<LessonPayload | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/academico/aluno/aulas/${lessonId}`, { cache: 'no-store' }).then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Aula indisponível.'); return payload.data; }).then((next) => { if (!cancelled) setData(next); }).catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; };
  }, [lessonId]);
  if (error) return <div className="rounded-3xl bg-rose-50 p-8 text-center text-sm font-bold text-rose-800">{error}</div>;
  if (!data) return <div className="aspect-video animate-pulse rounded-3xl bg-psi-darkest" />;
  return <LessonView data={data} />;
}

function LessonView({ data }: { data: LessonPayload }) {
  const [completed, setCompleted] = useState(data.completed);
  const complete = useCallback(async (lessonId: string) => {
    const response = await fetch(`/api/academico/aluno/aulas/${lessonId}/concluir`, { method: 'POST' });
    const payload = await response.json(); if (!response.ok) throw new Error(payload.error?.message ?? 'Falha ao registrar progresso.'); setCompleted(true);
  }, []);
  return <div className="space-y-6"><Link href={`/aluno/cursos/${data.course.id}`} className="inline-flex items-center gap-2 text-xs font-black text-muted"><ArrowLeft className="h-4 w-4" />Voltar ao curso</Link><div className="overflow-hidden rounded-[1.7rem] bg-psi-darkest shadow-2xl shadow-psi-darkest/15"><VimeoLessonPlayer lessonId={data.lesson.id} vimeoId={data.lesson.vimeoId} title={data.lesson.title} onCompleted={complete} /></div><section className="rounded-3xl border border-psi-darkest/10 bg-white p-6 sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><p className="text-[10px] font-black uppercase tracking-[.18em] text-psi-vibrant">{data.module.title}</p><h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold sm:text-4xl">{data.lesson.title}</h1>{data.lesson.description && <p className="mt-4 text-sm leading-6 text-muted">{data.lesson.description}</p>}</div>{completed && <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-xs font-black text-emerald-800"><CheckCircle2 className="h-4 w-4" />Aula concluída</span>}</div></section></div>;
}

export function VimeoLessonPlayer({ lessonId, vimeoId, title, onCompleted }: { lessonId: string; vimeoId: string; title: string; onCompleted: (lessonId: string) => Promise<void> | void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState('');
  const complete = useMemo(() => createCompletionHandler(async () => onCompleted(lessonId)), [lessonId, onCompleted]);
  const finish = useCallback(async () => { setError(''); try { await complete(); } catch { setError('O vídeo terminou, mas o progresso não foi salvo. Tente novamente.'); } }, [complete]);
  useEffect(() => {
    let player: VimeoPlayerPort | undefined; let unbind: (() => void) | undefined; let cancelled = false;
    loadVimeoScript().then(() => { if (cancelled || !iframeRef.current || !window.Vimeo) return; player = new window.Vimeo.Player(iframeRef.current); unbind = bindVimeoEnded(player, () => void finish()); }).catch((cause) => { if (!cancelled) setError(cause.message); });
    return () => { cancelled = true; unbind?.(); void player?.destroy(); };
  }, [finish]);
  return <div><div className="aspect-video"><iframe ref={iframeRef} src={`https://player.vimeo.com/video/${vimeoId}?dnt=1&title=0&byline=0&portrait=0`} title={title} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="h-full w-full border-0" /></div>{error && <div className="flex items-center justify-between gap-3 bg-rose-950 px-4 py-3 text-xs text-rose-100"><span>{error}</span><button onClick={() => void finish()} className="flex shrink-0 items-center gap-1 rounded-lg bg-white/10 px-3 py-2 font-black"><RefreshCw className="h-3.5 w-3.5" />Tentar novamente</button></div>}</div>;
}

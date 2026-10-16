'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Award, BookOpen, Home, LogOut, UserRound } from 'lucide-react';

type StudentIdentity = { fullName: string; mustChangePassword: boolean };

export function StudentShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [student, setStudent] = useState<StudentIdentity | null>(null);
  const publicPage = pathname === '/aluno/login';
  const passwordPage = pathname === '/aluno/trocar-senha';

  useEffect(() => {
    let cancelled = false;
    fetch('/api/academico/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unauthenticated');
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        const identity = payload.data.student as StudentIdentity;
        setStudent(identity);
        if (identity.mustChangePassword && !passwordPage) router.replace('/aluno/trocar-senha');
        else if (!identity.mustChangePassword && (publicPage || passwordPage)) router.replace('/aluno');
      })
      .catch(() => { if (!cancelled && !publicPage) router.replace('/aluno/login'); });
    return () => { cancelled = true; };
  }, [passwordPage, publicPage, router]);

  if (publicPage || passwordPage) return children;
  if (!student || student.mustChangePassword) return <div className="min-h-screen bg-[#f4eee7]" />;
  async function logout() { await fetch('/api/academico/auth/logout', { method: 'POST' }); router.replace('/aluno/login'); router.refresh(); }

  return <div className="min-h-screen bg-[#f4eee7] text-psi-darkest lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
    <aside className="hidden min-h-screen flex-col bg-psi-darkest px-5 py-7 text-white lg:flex">
      <Image src="/logo-viver-mais.png" alt="Viver Mais" width={152} height={54} className="h-auto w-36 brightness-0 invert" priority />
      <div className="mt-12"><p className="px-3 text-[10px] font-black uppercase tracking-[.2em] text-white/35">Seu espaço de estudo</p><StudentNavigation pathname={pathname} onLogout={() => void logout()} /></div>
      <div className="mt-auto rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-psi-vibrant">Aluno</p><p className="mt-1 truncate text-sm font-bold">{student.fullName}</p></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-30 border-b border-psi-darkest/10 bg-[#f4eee7]/95 px-4 py-3 backdrop-blur lg:hidden"><div className="flex items-center justify-between"><Image src="/logo-viver-mais.png" alt="Viver Mais" width={120} height={42} className="h-auto w-28" priority /><button onClick={() => void logout()} aria-label="Sair" className="rounded-xl border border-psi-darkest/10 bg-white p-2 text-psi-deep"><LogOut className="h-4 w-4" /></button></div><StudentNavigation pathname={pathname} onLogout={() => void logout()} compact /></header>
      <main className="mx-auto min-h-screen w-full max-w-7xl p-4 pb-10 sm:p-7 lg:p-10">{children}</main>
    </div>
  </div>;
}

export function StudentNavigation({ pathname, onLogout, compact = false }: { pathname: string; onLogout: () => void; compact?: boolean }) {
  const items = [
    { href: '/aluno', label: 'Visão geral', icon: Home },
    { href: '/aluno/cursos', label: 'Cursos e aulas', icon: BookOpen },
    { href: '/aluno/certificados', label: 'Certificados', icon: Award },
    { href: '/aluno/minha-conta', label: 'Minha conta', icon: UserRound },
  ];
  if (compact) return <nav aria-label="Navegação do aluno" className="no-scrollbar mt-3 flex gap-1 overflow-x-auto">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-black ${pathname === href ? 'bg-psi-deep text-white' : 'text-muted'}`}><Icon className="h-3.5 w-3.5" />{label}</Link>)}</nav>;
  return <nav aria-label="Navegação do aluno" className="mt-4 space-y-1">{items.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold transition ${pathname === href || (href === '/aluno/cursos' && pathname.startsWith('/aluno/cursos')) || (href === '/aluno/cursos' && pathname.startsWith('/aluno/aulas')) ? 'bg-white text-psi-darkest shadow-sm' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4" />{label}</Link>)}<button onClick={onLogout} className="mt-5 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-bold text-white/45 hover:bg-white/5 hover:text-white"><LogOut className="h-4 w-4" />Sair</button></nav>;
}

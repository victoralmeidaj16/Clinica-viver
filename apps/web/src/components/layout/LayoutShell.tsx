'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DemoNotice from '@/components/layout/DemoNotice';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<{ role: 'admin' | 'psicologo'; displayName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const isVitrinePage = pathname === '/vitrine';
  // O psicólogo abre a confirmação de contato a partir do link do WhatsApp,
  // frequentemente de outro aparelho e sem sessão. Exigir login aqui faria a
  // confirmação de 24h depender de lembrar uma senha no meio de uma conversa —
  // quem autoriza a página é o token assinado no próprio link.
  const isConfirmacaoContato = pathname.startsWith('/confirmar-contato/');
  const isPublicPage =
    pathname === '/login' || pathname === '/ativar-conta' || pathname === '/' || isVitrinePage || isConfirmacaoContato;

  useEffect(() => {
    if (isPublicPage) {
      return;
    }
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('unauthenticated');
        const envelope = await response.json() as { data: { role: 'admin' | 'psicologo'; displayName: string } };
        setAuth(envelope.data);
      })
      .catch(() => router.replace('/login'))
      .finally(() => setLoading(false));
  }, [isPublicPage, router]);

  useEffect(() => {
    if (!auth || isPublicPage) return;
    const adminPage = ['/gestao', '/relatorios', '/convenios', '/retencao', '/configuracoes'].some((prefix) => pathname.startsWith(prefix));
    const professionalPage = ['/cockpit', '/meu-cadastro', '/pacientes', '/meu-financeiro', '/agenda', '/avaliacoes', '/sessao'].some((prefix) => pathname.startsWith(prefix));
    const allowed = auth.role === 'admin' ? adminPage : professionalPage;
    if (!allowed) router.replace(auth.role === 'admin' ? '/gestao/cockpit' : '/cockpit');
  }, [auth, isPublicPage, pathname, router]);

  if (isPublicPage) {
    return <div className="w-full min-h-screen">{children}</div>;
  }

  if (loading || !auth) return <div className="min-h-screen bg-canvas" />;

  return (
    <div className="flex min-h-screen bg-canvas text-ink antialiased w-full">
      <Sidebar role={auth.role} onLogout={() => { void fetch('/api/auth/logout', { method: 'POST' }).finally(() => router.replace('/login')); }} />
      <div className="flex-1 flex flex-col min-w-0">
        <Header displayName={auth.displayName} role={auth.role} />
        <DemoNotice />
        <main className="p-8 flex-1">{children}</main>
      </div>
    </div>
  );
}

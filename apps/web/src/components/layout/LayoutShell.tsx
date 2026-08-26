'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DemoNotice from '@/components/layout/DemoNotice';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [auth, setAuth] = useState<{ role: 'admin' | 'psicologo'; displayName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const isVitrinePage = pathname === '/vitrine';
  const isConfirmacaoContato = pathname.startsWith('/confirmar-contato/');
  const isPaginaPagamento = pathname.startsWith('/pagar/');
  const isPaginaAgendamento = pathname.startsWith('/agendar/');
  // A prévia do layout do relatório de estágio não exige conta: sem estar
  // aqui, o `proxy.ts` deixa passar e é este componente que manda para o
  // login, no navegador, depois da página já ter começado a carregar.
  const isPreviaDocumento = pathname.startsWith('/previa-doc');
  const isCertificadosPage =
    pathname === '/validar-certificado' ||
    pathname.startsWith('/validar-certificado/') ||
    pathname === '/painel-certificados' ||
    pathname.startsWith('/painel-certificados/');

  const isPublicPage =
    pathname === '/login' ||
    pathname === '/ativar-conta' ||
    pathname === '/redefinir-senha' ||
    pathname === '/' ||
    isVitrinePage ||
    isConfirmacaoContato ||
    isPaginaPagamento ||
    isPaginaAgendamento ||
    isPreviaDocumento ||
    isCertificadosPage;

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
    const adminPage = ['/gestao', '/relatorios', '/convenios', '/configuracoes'].some((prefix) => pathname.startsWith(prefix));
    const professionalPage = ['/cockpit', '/meu-cadastro', '/pacientes', '/meu-financeiro', '/agenda', '/sessao', '/linha-do-tempo', '/relatorios'].some((prefix) => pathname.startsWith(prefix));
    const allowed = auth.role === 'admin' ? adminPage : professionalPage;
    if (!allowed) router.replace(auth.role === 'admin' ? '/gestao/cockpit' : '/cockpit');
  }, [auth, isPublicPage, pathname, router]);

  useEffect(() => {
    if (!menuAberto) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const tecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAberto(false);
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener('keydown', tecla);
    };
  }, [menuAberto]);

  if (isPublicPage) {
    return <div className="w-full min-h-screen">{children}</div>;
  }

  if (loading || !auth) return <div className="min-h-screen bg-canvas" />;

  return (
    <div className="flex min-h-screen bg-canvas text-ink antialiased w-full">
      <Sidebar
        role={auth.role}
        aberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        onLogout={() => { void fetch('/api/auth/logout', { method: 'POST' }).finally(() => router.replace('/login')); }}
      />

      {menuAberto && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-40 bg-psi-darkest/50 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${isCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        <Header
          displayName={auth.displayName}
          role={auth.role}
          onAbrirMenu={() => setMenuAberto(true)}
        />
        <DemoNotice />
        <main className="p-4 sm:p-6 lg:p-8 flex-1">{children}</main>
      </div>
    </div>
  );
}

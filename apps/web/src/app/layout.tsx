import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DemoNotice from '@/components/layout/DemoNotice';

export const metadata: Metadata = {
  title: 'Thats Life (TL - Psi) — Cockpit de Inteligência Clínica',
  description: 'Plataforma de automação pós-sessão em 1-clique, prontuários SOAP e acompanhamento terapêutico mobile.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen bg-canvas text-ink antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <DemoNotice />
          <main className="p-8 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}

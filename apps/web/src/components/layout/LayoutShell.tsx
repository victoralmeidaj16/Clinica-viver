'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import DemoNotice from '@/components/layout/DemoNotice';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVitrinePage = pathname === '/vitrine';

  if (isVitrinePage) {
    return <div className="w-full min-h-screen">{children}</div>;
  }

  return (
    <div className="flex min-h-screen bg-canvas text-ink antialiased w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header />
        <DemoNotice />
        <main className="p-8 flex-1">{children}</main>
      </div>
    </div>
  );
}

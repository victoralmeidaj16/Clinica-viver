'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  Users,
  FileText,
  UserCheck,
  CreditCard,
  ClipboardList,
  Brain,
  Smartphone,
  ChevronRight,
  History,
  CalendarDays,
  Target,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Cockpit 1-Clique',
      href: '/cockpit',
      icon: Zap,
      badge: 'IA SOAP',
      badgeColor: 'bg-accent/20 text-amber-900 border-accent/30',
    },
    {
      label: 'Avaliações & Escalas',
      href: '/avaliacoes',
      icon: ClipboardList,
      badge: 'Escalas IA',
      badgeColor: 'bg-capri-soft text-cyan-900 border-capri/30',
    },
    {
      label: 'Linha do Tempo Clínica',
      href: '/linha-do-tempo',
      icon: History,
      badge: 'Memória',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    {
      label: 'Agenda',
      href: '/agenda',
      icon: CalendarDays,
      badge: 'Google futuro',
      badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    },
    {
      label: 'Acompanhamento',
      href: '/acompanhamento',
      icon: Target,
    },
    {
      label: 'Gestão de Pacientes',
      href: '/pacientes',
      icon: Users,
    },
    {
      label: 'Prontuários SOAP',
      href: '/prontuarios',
      icon: FileText,
    },
    {
      label: 'Supervisão Clínica',
      href: '/supervisao',
      icon: UserCheck,
      badge: 'Anonimização',
      badgeColor: 'bg-primary/10 text-primary border-primary/20',
    },
    {
      label: 'Financeiro & Pix',
      href: '/financeiro',
      icon: CreditCard,
    },
  ];

  return (
    <aside className="w-64 bg-surface border-r border-line flex flex-col justify-between h-screen sticky top-0 z-40 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-20 px-6 flex items-center gap-3 border-b border-line">
          <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shadow-md">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg text-ink leading-none">
              Thats Life <span className="text-primary text-xs font-semibold">Psi</span>
            </h1>
            <p className="text-[11px] text-muted font-medium mt-0.5">Inteligência Clínica</p>
          </div>
        </div>

        {/* Navigation List */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-[11px] font-bold text-muted uppercase tracking-wider">
            Menu do Consultório
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/cockpit');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 group ${
                  isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'text-muted hover:text-ink hover:bg-soft'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-primary/80 group-hover:text-primary'}`} />
                  <span>{item.label}</span>
                </div>

                {item.badge ? (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                ) : (
                  <ChevronRight className={`w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-white' : 'text-muted'}`} />
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* App Mobile Integration Footer */}
      <div className="p-4 border-t border-line">
        <div className="p-3.5 rounded-2xl bg-capri-soft/50 border border-capri/20 text-left">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <Smartphone className="w-4 h-4 text-capri" />
            <span>App Mobile do Paciente</span>
          </div>
          <p className="text-[11px] text-muted mt-1 leading-snug">
            Questionários pré-sessão sincronizados via Expo/React Native.
          </p>
        </div>
      </div>
    </aside>
  );
}

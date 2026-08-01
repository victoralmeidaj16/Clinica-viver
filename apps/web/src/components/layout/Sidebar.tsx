'use client';

import React, { useState } from 'react';
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
  History,
  CalendarDays,
  Target,
  Video,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const navItems = [
    {
      label: 'Cockpit 1-Clique',
      href: '/cockpit',
      icon: Zap,
    },
    {
      label: 'Sessão Zoom ao Vivo',
      href: '/sessao/demo',
      icon: Video,
    },
    {
      label: 'Avaliações & Escalas',
      href: '/avaliacoes',
      icon: ClipboardList,
    },
    {
      label: 'Linha do Tempo Clínica',
      href: '/linha-do-tempo',
      icon: History,
    },
    {
      label: 'Agenda & Pagamentos',
      href: '/agenda',
      icon: CalendarDays,
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
    },
    {
      label: 'Financeiro & Pix',
      href: '/financeiro',
      icon: CreditCard,
    },
    {
      label: 'Integrações (Asaas/Wpp)',
      href: '/configuracoes/integracoes',
      icon: Brain,
    },
  ];

  return (
    <aside
      className={`bg-psi-darkest text-white flex flex-col justify-between h-screen sticky top-0 z-40 select-none shadow-contrast transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-68'
      }`}
    >
      <div>
        {/* Header do Menu com Botão de Minimizar */}
        <div className="h-20 px-5 flex items-center justify-between border-b border-white/10 relative">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-psi-vibrant text-white flex items-center justify-center shrink-0 shadow-md">
              <Brain className="w-6 h-6" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-200">
                <h1 className="font-extrabold text-lg text-white leading-none tracking-tight flex items-center gap-1.5">
                  Thats Life <span className="text-psi-darkest text-xs font-black px-1.5 py-0.5 rounded-md bg-psi-vibrant">Psi</span>
                </h1>
                <p className="text-[11px] text-psi-soft/70 font-medium mt-1 whitespace-nowrap">Inteligência Clínica</p>
              </div>
            )}
          </div>

          {/* Toggle Minimizar / Expandir */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={isCollapsed ? 'Expandir Menu' : 'Minimizar Menu'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Lista de Navegação sem etiquetas */}
        <nav className="p-3 space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-2 text-[10px] font-black text-psi-soft/50 uppercase tracking-widest animate-in fade-in">
              Menu do Consultório
            </div>
          )}
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/cockpit');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={isCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-200 group ${
                  isActive
                    ? 'bg-psi-vibrant text-white shadow-lg shadow-psi-vibrant/30 scale-[1.01]'
                    : 'text-psi-soft/80 hover:text-white hover:bg-white/10'
                } ${isCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-psi-vibrant group-hover:text-white'}`} />
                {!isCollapsed && <span className="truncate animate-in fade-in">{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* App Mobile Footer */}
      <div className="p-3 border-t border-white/10">
        <div className={`p-3 rounded-xl bg-white/5 border border-white/10 text-left ${isCollapsed ? 'flex justify-center p-2' : 'space-y-1'}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Smartphone className="w-4 h-4 text-psi-vibrant shrink-0" />
            {!isCollapsed && <span>App do Paciente</span>}
          </div>
          {!isCollapsed && (
            <p className="text-[11px] text-psi-soft/70 leading-snug">
              Sincronizado via Expo.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

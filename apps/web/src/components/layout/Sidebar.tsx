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
  Shield,
  Briefcase,
  TrendingDown,
  BarChart3,
  Sparkles,
  Inbox,
  UserPlus,
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeRole, setActiveRole] = useState<'psicologo' | 'gestao'>('psicologo');

  const psicologoItems = [
    {
      label: 'Cockpit 1-Clique',
      href: '/cockpit',
      icon: Zap,
    },
    {
      label: 'Meus Pacientes',
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
      label: 'Meu Financeiro (70%)',
      href: '/meu-financeiro',
      icon: CreditCard,
    },
    {
      label: 'Agenda & Horários',
      href: '/agenda',
      icon: CalendarDays,
    },
    {
      label: 'Avaliações & Escalas',
      href: '/avaliacoes',
      icon: ClipboardList,
    },
    {
      label: 'Linha do Tempo',
      href: '/linha-do-tempo',
      icon: History,
    },
    {
      label: 'Site / Vitrine de Serviços',
      href: '/vitrine',
      icon: Sparkles,
    },
    {
      label: 'Sessão Zoom ao Vivo',
      href: '/sessao/demo',
      icon: Video,
    },
  ];

  const gestaoItems = [
    {
      label: 'Site / Vitrine de Serviços',
      href: '/vitrine',
      icon: Sparkles,
    },
    {
      label: 'Cockpit da Clínica (SLA)',
      href: '/gestao/cockpit',
      icon: Shield,
    },
    {
      label: '11 Indicadores Mensais',
      href: '/relatorios',
      icon: BarChart3,
    },
    {
      label: 'Convênios PJ (Canguru)',
      href: '/convenios',
      icon: Briefcase,
    },
    {
      label: 'Auditoria & Retenção',
      href: '/retencao',
      icon: TrendingDown,
    },
    {
      label: 'Integrações (Asaas/Wpp)',
      href: '/configuracoes/integracoes',
      icon: Brain,
    },
  ];

  const navItems = activeRole === 'psicologo' ? psicologoItems : gestaoItems;

  return (
    <aside
      className={`bg-psi-darkest text-white flex flex-col justify-between h-screen sticky top-0 z-40 select-none shadow-contrast transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className="overflow-y-auto no-scrollbar">
        {/* Header do Menu com Branding Viver Mais */}
        <div className="h-20 px-4 flex items-center justify-between border-b border-white/10 relative">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-psi-vibrant text-white flex items-center justify-center shrink-0 shadow-md">
              <Brain className="w-6 h-6" />
            </div>
            {!isCollapsed && (
              <div className="animate-in fade-in duration-200">
                <h1 className="font-black text-sm text-white leading-none tracking-tight flex items-center gap-1">
                  Viver Mais <span className="text-psi-darkest text-[10px] font-black px-1.5 py-0.5 rounded-md bg-psi-vibrant">Psi</span>
                </h1>
                <p className="text-[10px] text-psi-soft/70 font-semibold mt-1 whitespace-nowrap">Clínica Escola & Atendimento</p>
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

        {/* Seletor de Perfil (Psicólogo vs Gestão) */}
        {!isCollapsed && (
          <div className="p-3 border-b border-white/10">
            <div className="bg-white/5 p-1 rounded-xl flex items-center gap-1 border border-white/10">
              <button
                type="button"
                onClick={() => setActiveRole('psicologo')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                  activeRole === 'psicologo'
                    ? 'bg-psi-vibrant text-white shadow-sm'
                    : 'text-psi-soft/70 hover:text-white hover:bg-white/5'
                }`}
              >
                Psicólogo
              </button>
              <button
                type="button"
                onClick={() => setActiveRole('gestao')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all ${
                  activeRole === 'gestao'
                    ? 'bg-psi-vibrant text-white shadow-sm'
                    : 'text-psi-soft/70 hover:text-white hover:bg-white/5'
                }`}
              >
                Gestão
              </button>
            </div>
          </div>
        )}

        {/* Lista de Navegação */}
        <nav className="p-3 space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-black text-psi-soft/50 uppercase tracking-widest animate-in fade-in flex items-center justify-between">
              <span>{activeRole === 'psicologo' ? 'Portal do Psicólogo' : 'Cockpit de Gestão'}</span>
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
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group ${
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

      {/* Footer Viver Mais */}
      <div className="p-3 border-t border-white/10 shrink-0">
        <div className={`p-2.5 rounded-xl bg-white/5 border border-white/10 text-left ${isCollapsed ? 'flex justify-center p-2' : 'space-y-1'}`}>
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Smartphone className="w-4 h-4 text-psi-vibrant shrink-0" />
            {!isCollapsed && <span>App do Paciente</span>}
          </div>
          {!isCollapsed && (
            <p className="text-[10px] text-psi-soft/70 leading-snug">
              Sincronizado via Expo.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}

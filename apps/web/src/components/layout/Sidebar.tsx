'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  Users,
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
  LogOut,
} from 'lucide-react';

export default function Sidebar({ role, onLogout }: { role: 'admin' | 'psicologo'; onLogout: () => void }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const psicologoItems = [
    {
      label: 'Cockpit 1-Clique',
      href: '/cockpit',
      icon: Zap,
    },
    {
      label: 'Meu Cadastro',
      href: '/meu-cadastro',
      icon: UserPlus,
    },
    {
      label: 'Meus Pacientes',
      href: '/pacientes',
      icon: Users,
    },
    {
      label: 'Meu Financeiro',
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
      label: 'Site / Vitrine de Serviços',
      href: '/vitrine',
      icon: Sparkles,
    },
  ];

  const gestaoItems = [
    {
      label: 'Gestão de Psicólogos',
      href: '/gestao/psicologos',
      icon: UserCheck,
    },
    {
      label: 'Gestão de Pacientes',
      href: '/gestao/pacientes',
      icon: Users,
    },
    {
      label: 'Cockpit da Clínica (SLA)',
      href: '/gestao/cockpit',
      icon: Shield,
    },
    {
      label: 'Site / Vitrine de Serviços',
      href: '/vitrine',
      icon: Sparkles,
    },
    {
      label: '11 Indicadores Mensais',
      href: '/relatorios',
      icon: BarChart3,
    },
    {
      label: 'Convênios PJ',
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

  const isProfessional = role === 'psicologo';
  const navItems = isProfessional ? psicologoItems : gestaoItems;

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

        {/* O perfil vem da sessão; não é um seletor visual. */}
        {!isCollapsed && (
          <div className="p-3 border-b border-white/10">
            <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-[10px] uppercase tracking-widest text-psi-soft/50">Perfil ativo</p>
              <p className="mt-1 text-xs font-bold text-white">{isProfessional ? 'Psicólogo da clínica' : 'Administrador da clínica'}</p>
            </div>
          </div>
        )}

        {/* Lista de Navegação */}
        <nav className="p-3 space-y-1">
          {!isCollapsed && (
            <div className="px-3 py-1.5 text-[10px] font-black text-psi-soft/50 uppercase tracking-widest animate-in fade-in flex items-center justify-between">
              <span>{isProfessional ? 'Portal do Psicólogo' : 'Cockpit de Gestão'}</span>
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
      <div className="border-t border-white/10 p-3">
        <button type="button" onClick={onLogout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-bold text-psi-soft/80 transition-colors hover:bg-white/10 hover:text-white ${isCollapsed ? 'justify-center px-0' : ''}`}>
          <LogOut className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span>Sair da conta</span>}
        </button>
      </div>
    </aside>
  );
}

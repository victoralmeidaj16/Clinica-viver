'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Zap,
  Users,
  UserCheck,
  CreditCard,
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Shield,
  Briefcase,
  TrendingDown,
  BarChart3,
  Sparkles,
  UserPlus,
  LogOut,
  X,
} from 'lucide-react';

/**
 * Menu lateral — gaveta no celular, coluna fixa no desktop.
 *
 * A largura de 16 rem era subtraída da tela em qualquer tamanho: num aparelho
 * de 390 px sobravam pouco mais de 130 px para o conteúdo, o que deixava o
 * cockpit ilegível justamente onde ele é mais consultado — o psicólogo abre o
 * sistema pelo link que chega no WhatsApp, no celular. A partir de `lg` nada
 * muda: a coluna volta a ser fixa e o botão de minimizar continua onde estava.
 *
 * O estado de aberto/fechado mora no `LayoutShell` porque quem o alterna é o
 * botão do header, do outro lado da árvore.
 */
export default function Sidebar({
  role,
  onLogout,
  aberto,
  onFechar,
}: {
  role: 'admin' | 'psicologo';
  onLogout: () => void;
  aberto: boolean;
  onFechar: () => void;
}) {
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
      label: 'Financeiro & Repasses',
      href: '/gestao/financeiro',
      icon: CreditCard,
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

  // Minimizar é recurso de desktop: na gaveta o menu ou está aberto por
  // inteiro ou fechado, e um menu de ícones sem rótulo em tela de toque só
  // adiciona adivinhação.
  const colapsado = isCollapsed;

  return (
    <aside
      id="menu-lateral"
      // `invisible` fechado, e não só o deslocamento: um menu apenas empurrado
      // para fora da tela continua no caminho do teclado e do leitor de tela.
      // A transição inclui `visibility` para que o painel só suma ao terminar
      // de deslizar. Em `lg` ele é sempre visível, independente do estado.
      className={`bg-psi-darkest text-white flex flex-col justify-between select-none shadow-contrast z-50
        fixed inset-y-0 left-0 w-[17rem] max-w-[85vw] transition-[transform,visibility] duration-300
        lg:sticky lg:top-0 lg:z-40 lg:visible lg:translate-x-0 lg:max-w-none lg:h-screen
        ${aberto ? 'translate-x-0 visible' : '-translate-x-full invisible'}
        ${colapsado ? 'lg:w-20' : 'lg:w-64'}`}
    >
      <div className="overflow-y-auto no-scrollbar">
        {/* Header do Menu com Branding Viver Mais */}
        <div className="h-16 sm:h-20 px-4 flex items-center justify-between border-b border-white/10 relative">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-psi-vibrant text-white flex items-center justify-center shrink-0 shadow-md">
              <Brain className="w-6 h-6" />
            </div>
            <div className={`animate-in fade-in duration-200 ${colapsado ? 'lg:hidden' : ''}`}>
              <h1 className="font-black text-sm text-white leading-none tracking-tight flex items-center gap-1">
                Viver Mais <span className="text-psi-darkest text-[10px] font-black px-1.5 py-0.5 rounded-md bg-psi-vibrant">Psi</span>
              </h1>
              <p className="text-[10px] text-psi-soft/70 font-semibold mt-1 whitespace-nowrap">Clínica Escola & Atendimento</p>
            </div>
          </div>

          {/* Fechar a gaveta (toque) / Minimizar o menu (desktop) */}
          <button
            type="button"
            onClick={onFechar}
            className="lg:hidden p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            aria-label="Fechar menu"
          >
            <X className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:block p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            title={colapsado ? 'Expandir Menu' : 'Minimizar Menu'}
          >
            {colapsado ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* O perfil vem da sessão; não é um seletor visual. */}
        <div className={`p-3 border-b border-white/10 ${colapsado ? 'lg:hidden' : ''}`}>
          <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[10px] uppercase tracking-widest text-psi-soft/50">Perfil ativo</p>
            <p className="mt-1 text-xs font-bold text-white">{isProfessional ? 'Psicólogo da clínica' : 'Administrador da clínica'}</p>
          </div>
        </div>

        {/* Lista de Navegação */}
        <nav className="p-3 space-y-1">
          <div
            className={`px-3 py-1.5 text-[10px] font-black text-psi-soft/50 uppercase tracking-widest animate-in fade-in flex items-center justify-between ${
              colapsado ? 'lg:hidden' : ''
            }`}
          >
            <span>{isProfessional ? 'Portal do Psicólogo' : 'Cockpit de Gestão'}</span>
          </div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname === '/' && item.href === '/cockpit');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                // Navegar fecha a gaveta: no celular a página nova aparece
                // atrás do menu, e deixá-lo aberto obrigaria a um segundo toque
                // para ver o que se acabou de pedir.
                onClick={onFechar}
                title={colapsado ? item.label : undefined}
                className={`flex items-center gap-3 px-3.5 py-3 lg:py-2.5 rounded-xl text-xs font-bold transition-all duration-200 group ${
                  isActive
                    ? 'bg-psi-vibrant text-white shadow-lg shadow-psi-vibrant/30 lg:scale-[1.01]'
                    : 'text-psi-soft/80 hover:text-white hover:bg-white/10'
                } ${colapsado ? 'lg:justify-center lg:px-0' : ''}`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-psi-vibrant group-hover:text-white'}`} />
                <span className={`truncate animate-in fade-in ${colapsado ? 'lg:hidden' : ''}`}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="border-t border-white/10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onLogout}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 lg:py-2.5 text-xs font-bold text-psi-soft/80 transition-colors hover:bg-white/10 hover:text-white ${
            colapsado ? 'lg:justify-center lg:px-0' : ''
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={colapsado ? 'lg:hidden' : ''}>Sair da conta</span>
        </button>
      </div>
    </aside>
  );
}

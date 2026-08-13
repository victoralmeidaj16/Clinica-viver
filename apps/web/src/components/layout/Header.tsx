'use client';

import React from 'react';
import { Menu, Search, UserCheck } from 'lucide-react';
import NotificationsBell from '@/components/layout/NotificationsBell';

export default function Header({
  displayName,
  role,
  onAbrirMenu,
}: {
  displayName: string;
  role: 'admin' | 'psicologo';
  onAbrirMenu: () => void;
}) {
  return (
    <header className="h-16 sm:h-20 bg-white border-b border-psi-soft/60 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sticky top-0 z-30 shadow-card">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Abre a gaveta do menu. Some quando a coluna lateral volta a ser fixa. */}
        <button
          type="button"
          onClick={onAbrirMenu}
          className="lg:hidden p-2.5 -ml-1 rounded-xl text-muted hover:text-ink hover:bg-psi-light transition-colors"
          aria-label="Abrir menu"
          aria-controls="menu-lateral"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* No celular a busca cede o lugar: o essencial da barra é navegar e
            ver o que chegou, e um campo de texto aqui empurraria os dois. */}
        <div className="relative hidden md:block w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar paciente ou sessão..."
            className="w-full bg-psi-light border border-psi-soft/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:bg-white focus:ring-2 focus:ring-psi-vibrant/20 focus:border-psi-vibrant transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-5 shrink-0">
        {/* Notificações — lista real, derivada da fila e do credenciamento. */}
        <NotificationsBell />

        <div className="hidden sm:block h-6 w-[1px] bg-psi-soft" />

        {/* Usuário autenticado */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-psi-soft border border-psi-vibrant/30 flex items-center justify-center font-bold text-psi-darkest shadow-sm shrink-0">
            <UserCheck className="w-5 h-5 text-psi-deep" />
          </div>
          <div className="hidden sm:block text-left min-w-0">
            <p className="text-xs font-bold text-ink leading-tight truncate max-w-[12rem]">{displayName}</p>
            <p className="text-[10px] text-muted font-medium">{role === 'admin' ? 'Administrador da clínica' : 'Psicólogo da clínica'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}

'use client';

import React from 'react';
import { Bell, Search, ShieldCheck, WifiOff, UserCheck } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-20 bg-surface border-b border-line px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm">
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar paciente, prontuário ou sessão..."
            className="w-full bg-soft/60 border border-line rounded-xl pl-10 pr-4 py-2 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-white transition-all"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        {/* Integration status */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
          <WifiOff className="w-3.5 h-3.5" />
          <span>Integrações simuladas</span>
        </div>

        {/* Compliance status */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-muted bg-soft px-3 py-1.5 rounded-full border border-line">
          <ShieldCheck className="w-4 h-4 text-primary" />
          <span>Compliance em implementação</span>
        </div>

        {/* Notificações */}
        <button className="relative p-2 rounded-xl text-muted hover:text-ink hover:bg-soft transition-colors" title="Notificações">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
        </button>

        <div className="h-6 w-[1px] bg-line" />

        {/* Usuário Psicólogo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-primary">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-sm font-bold text-ink leading-tight">Dra. Camila Vasconcelos</p>
            <p className="text-xs text-muted">CRP 06/148293 • Psicóloga</p>
          </div>
        </div>
      </div>
    </header>
  );
}

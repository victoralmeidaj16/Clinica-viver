'use client';

import React from 'react';
import { Bell, Search, ShieldCheck, UserCheck, Sparkles } from 'lucide-react';

export default function Header() {
  return (
    <header className="h-20 bg-white border-b border-psi-soft/60 px-8 flex items-center justify-between sticky top-0 z-30 shadow-card">
      <div className="flex items-center gap-4 w-1/3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar paciente, prontuário ou sessão..."
            className="w-full bg-psi-light border border-psi-soft/80 rounded-xl pl-10 pr-4 py-2.5 text-xs text-ink placeholder:text-muted focus:outline-none focus:bg-white focus:ring-2 focus:ring-psi-vibrant/20 focus:border-psi-vibrant transition-all shadow-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Compliance status */}
        <div className="hidden lg:flex items-center gap-2 text-xs font-semibold text-psi-darkest bg-psi-light px-4 py-2 rounded-xl border border-psi-soft">
          <ShieldCheck className="w-4 h-4 text-psi-deep" />
          <span>CFP & LGPD Compliant</span>
        </div>

        {/* Status de IA */}
        <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-psi-soft text-psi-darkest text-xs font-bold border border-psi-vibrant/20">
          <Sparkles className="w-3.5 h-3.5 text-psi-vibrant animate-pulse" />
          <span>Motor de IA Ativo</span>
        </div>

        {/* Notificações */}
        <button className="relative p-2.5 rounded-xl text-muted hover:text-ink hover:bg-psi-light transition-colors" title="Notificações">
          <Bell className="w-4 h-4" />
          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-psi-vibrant" />
        </button>

        <div className="h-6 w-[1px] bg-psi-soft" />

        {/* Usuário Psicólogo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-psi-soft border border-psi-vibrant/30 flex items-center justify-center font-bold text-psi-darkest shadow-sm">
            <UserCheck className="w-5 h-5 text-psi-deep" />
          </div>
          <div className="hidden sm:block text-left">
            <p className="text-xs font-bold text-ink leading-tight">Dra. Camila Vasconcelos</p>
            <p className="text-[10px] text-muted font-medium">CRP 06/148293 • Psicóloga</p>
          </div>
        </div>
      </div>
    </header>
  );
}

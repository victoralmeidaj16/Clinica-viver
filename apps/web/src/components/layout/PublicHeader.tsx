'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  UserPlus,
  Calendar,
  LogIn,
  ChevronDown,
} from 'lucide-react';

export type PublicNavModo = 'PACIENTE' | 'ESPECIALISTA';

interface PublicHeaderProps {
  modoAtivo?: PublicNavModo;
  onSelecionarModo?: (modo: PublicNavModo) => void;
  onAgendarClick?: () => void;
  onCredenciarClick?: () => void;
  /** Faixa fixada logo abaixo da barra principal (ex.: etapas do agendamento). */
  barraInferior?: React.ReactNode;
}

export default function PublicHeader({
  modoAtivo = 'PACIENTE',
  onSelecionarModo,
  onAgendarClick,
  onCredenciarClick,
  barraInferior,
}: PublicHeaderProps) {
  const [menuAberto, setMenuAberto] = useState(false);

  useEffect(() => {
    if (!menuAberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAberto(false);
    };
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [menuAberto]);

  const handleModoClick = (modo: PublicNavModo) => {
    if (onSelecionarModo) {
      onSelecionarModo(modo);
    }
    setMenuAberto(false);
  };

  const handleAgendar = () => {
    if (onAgendarClick) {
      onAgendarClick();
    } else if (onSelecionarModo) {
      onSelecionarModo('PACIENTE');
    }
    setMenuAberto(false);
  };

  const handleCredenciar = () => {
    if (onCredenciarClick) {
      onCredenciarClick();
    } else if (onSelecionarModo) {
      onSelecionarModo('ESPECIALISTA');
    }
    setMenuAberto(false);
  };

  return (
    <header className="bg-white/95 border-b border-purple-100 sticky top-0 z-40 backdrop-blur-md shadow-sm transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        {/* 1. Logo da Clínica à esquerda */}
        <Link
          href="/"
          onClick={() => handleModoClick('PACIENTE')}
          className="group shrink-0 rounded-xl p-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
          aria-label="Clínica Viver Mais Psicologia - Início"
        >
          <Image
            src="/logo-viver-mais.png"
            alt="Viver Mais Psicologia"
            width={317}
            height={60}
            className="h-auto w-[190px] transition-transform duration-200 group-hover:scale-[1.02] sm:w-[222px] lg:w-[254px]"
            priority
          />
        </Link>

        {/* 2. Ações: o agendamento fica sempre à vista; o resto mora no menu DEMO */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          <button
            type="button"
            onClick={handleAgendar}
            className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-3 py-2.5 rounded-xl transition-all shadow-md shadow-purple-600/25 active:scale-95 flex items-center gap-1.5 shrink-0 sm:px-4"
          >
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Agendar Consulta</span>
            <span className="sm:hidden">Agendar</span>
          </button>

          <button
            type="button"
            onClick={() => setMenuAberto(!menuAberto)}
            aria-expanded={menuAberto}
            aria-controls="menu-demo"
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-extrabold transition-all shrink-0 ${
              menuAberto
                ? 'bg-purple-50 text-purple-800 border-purple-200'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-purple-50 hover:text-purple-700'
            }`}
          >
            <span className="tracking-wider">DEMO</span>
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-200 ${menuAberto ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Sanfona DEMO: navegação de perfis e acesso restrito */}
      {menuAberto && (
        <div
          id="menu-demo"
          className="border-t border-purple-100 bg-white/98 px-4 py-4 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200"
        >
          <div className="mx-auto max-w-6xl space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
              Escolha o que você procura:
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => handleModoClick('PACIENTE')}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-black border transition-all ${
                  modoAtivo === 'PACIENTE'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-200'
                }`}
              >
                <Heart className="w-4 h-4" />
                <span>Para Você</span>
              </button>
              <button
                type="button"
                onClick={handleCredenciar}
                className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-black border transition-all ${
                  modoAtivo === 'ESPECIALISTA'
                    ? 'bg-purple-700 text-white border-purple-700 shadow-md'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-purple-200'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Para Especialistas</span>
              </button>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <Link
                href="/login"
                onClick={() => setMenuAberto(false)}
                className="w-full text-center text-slate-700 bg-slate-100 hover:bg-purple-50 text-xs font-bold py-2.5 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5 text-purple-600" />
                <span>Área do Psicólogo / Login</span>
              </Link>
            </div>
          </div>
        </div>
      )}

      {barraInferior}
    </header>
  );
}

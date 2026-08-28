'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Heart,
  UserPlus,
  Calendar,
  LogIn,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';

export type PublicNavModo = 'PACIENTE' | 'ESPECIALISTA';

interface PublicHeaderProps {
  modoAtivo?: PublicNavModo;
  onSelecionarModo?: (modo: PublicNavModo) => void;
  onAgendarClick?: () => void;
  onCredenciarClick?: () => void;
}

export default function PublicHeader({
  modoAtivo = 'PACIENTE',
  onSelecionarModo,
  onAgendarClick,
  onCredenciarClick,
}: PublicHeaderProps) {
  const [menuMobileAberto, setMenuMobileAberto] = useState(false);

  const handleModoClick = (modo: PublicNavModo) => {
    if (onSelecionarModo) {
      onSelecionarModo(modo);
    }
    setMenuMobileAberto(false);
  };

  const handleAgendar = () => {
    if (onAgendarClick) {
      onAgendarClick();
    } else if (onSelecionarModo) {
      onSelecionarModo('PACIENTE');
    }
    setMenuMobileAberto(false);
  };

  const handleCredenciar = () => {
    if (onCredenciarClick) {
      onCredenciarClick();
    } else if (onSelecionarModo) {
      onSelecionarModo('ESPECIALISTA');
    }
    setMenuMobileAberto(false);
  };

  return (
    <header className="bg-white/95 border-b border-purple-100 sticky top-0 z-40 backdrop-blur-md shadow-sm transition-all">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
        {/* 1. Logo da Clínica à esquerda */}
        <Link
          href="/"
          onClick={() => handleModoClick('PACIENTE')}
          className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-xl p-1"
          aria-label="Clínica Viver Mais Psicologia - Início"
        >
          <div className="relative w-10 h-10 rounded-2xl overflow-hidden bg-purple-600 shadow-md shadow-purple-600/25 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <Image
              src="/logo-viver-mais.png"
              alt="Logo Viver Mais"
              width={40}
              height={40}
              className="object-contain"
              priority
              onError={(e) => {
                // Fallback invisível se a imagem não carregar
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <Sparkles className="w-5 h-5 text-white absolute" />
          </div>
          <div>
            <span className="text-base sm:text-lg font-black tracking-tight text-slate-900 leading-none block">
              Viver Mais
            </span>
            <span className="text-[10px] sm:text-[11px] text-purple-600 font-extrabold uppercase tracking-wider block mt-0.5">
              Psicologia
            </span>
          </div>
        </Link>

        {/* 2. Navegação Central Segmentada (2 Menus Claros: "Para Você" vs "Para Especialistas") */}
        <nav
          aria-label="Navegação de perfis"
          className="hidden md:flex items-center p-1 bg-slate-100/90 rounded-2xl border border-purple-100 shadow-inner"
        >
          <button
            type="button"
            onClick={() => handleModoClick('PACIENTE')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              modoAtivo === 'PACIENTE'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'text-slate-600 hover:text-purple-700 hover:bg-white/60'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${modoAtivo === 'PACIENTE' ? 'text-pink-200 fill-pink-200' : 'text-slate-400'}`} />
            <span>Para Você</span>
          </button>
          <button
            type="button"
            onClick={() => handleModoClick('ESPECIALISTA')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${
              modoAtivo === 'ESPECIALISTA'
                ? 'bg-purple-700 text-white shadow-md shadow-purple-700/30'
                : 'text-slate-600 hover:text-purple-700 hover:bg-white/60'
            }`}
          >
            <UserPlus className={`w-3.5 h-3.5 ${modoAtivo === 'ESPECIALISTA' ? 'text-purple-200' : 'text-slate-400'}`} />
            <span>Para Especialistas</span>
          </button>
        </nav>

        {/* 3. Ações no Canto Direito (CTA de Agendamento/Credenciamento + Login) */}
        <div className="hidden sm:flex items-center gap-2.5">
          {modoAtivo === 'PACIENTE' ? (
            <button
              type="button"
              onClick={handleAgendar}
              className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-600/25 active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <Calendar className="w-4 h-4" />
              <span>Agendar Consulta</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleCredenciar}
              className="bg-purple-700 hover:bg-purple-800 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md shadow-purple-700/25 active:scale-95 flex items-center gap-1.5 shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>Quero me Credenciar</span>
            </button>
          )}

          <Link
            href="/login"
            className="text-slate-600 hover:text-purple-700 hover:bg-purple-50 text-xs font-bold px-3 py-2.5 rounded-xl transition-all border border-slate-200 flex items-center gap-1.5 shrink-0"
            title="Acesso restrito para psicólogos e gestão"
          >
            <LogIn className="w-3.5 h-3.5 text-purple-600" />
            <span className="hidden lg:inline">Área do Psicólogo</span>
            <span className="lg:hidden">Entrar</span>
          </Link>
        </div>

        {/* Botão Hambúrguer para Mobile */}
        <div className="flex md:hidden items-center gap-2">
          <button
            type="button"
            onClick={() => setMenuMobileAberto(!menuMobileAberto)}
            className="p-2.5 rounded-xl bg-slate-100 text-slate-700 hover:text-purple-700 hover:bg-purple-50 border border-slate-200"
            aria-label="Abrir menu de navegação"
          >
            {menuMobileAberto ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Menu Drawer Mobile Expansível */}
      {menuMobileAberto && (
        <div className="md:hidden border-t border-purple-100 bg-white/98 px-4 py-4 space-y-3 shadow-xl animate-in slide-in-from-top-2 duration-200">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
            Escolha o que você procura:
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleModoClick('PACIENTE')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-black border transition-all ${
                modoAtivo === 'PACIENTE'
                  ? 'bg-purple-600 text-white border-purple-600 shadow-md'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <Heart className="w-4 h-4" />
              <span>Para Você</span>
            </button>
            <button
              type="button"
              onClick={() => handleModoClick('ESPECIALISTA')}
              className={`flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-black border transition-all ${
                modoAtivo === 'ESPECIALISTA'
                  ? 'bg-purple-700 text-white border-purple-700 shadow-md'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Para Especialistas</span>
            </button>
          </div>

          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            {modoAtivo === 'PACIENTE' ? (
              <button
                type="button"
                onClick={handleAgendar}
                className="w-full bg-purple-600 text-white font-extrabold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                <span>Agendar Consulta Agora</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCredenciar}
                className="w-full bg-purple-700 text-white font-extrabold text-xs py-3 rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Preencher Formulário de Parceria</span>
              </button>
            )}

            <Link
              href="/login"
              onClick={() => setMenuMobileAberto(false)}
              className="w-full text-center text-slate-700 bg-slate-100 hover:bg-purple-50 text-xs font-bold py-2.5 rounded-xl border border-slate-200 flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-3.5 h-3.5 text-purple-600" />
              <span>Área do Psicólogo / Login</span>
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

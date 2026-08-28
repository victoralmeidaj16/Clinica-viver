'use client';

import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

interface FloatingWhatsAppButtonProps {
  numeroTelefone?: string;
  mensagemPadrao?: string;
}

export default function FloatingWhatsAppButton({
  numeroTelefone = '5511999999999',
  mensagemPadrao = 'Olá! Gostaria de tirar algumas dúvidas sobre os atendimentos na Clínica Viver Mais.',
}: FloatingWhatsAppButtonProps) {
  const [mostrarTooltip, setMostrarTooltip] = useState(false);

  const telefoneLimpo = numeroTelefone.replace(/\D/g, '');
  const urlWhatsApp = `https://wa.me/${telefoneLimpo}?text=${encodeURIComponent(mensagemPadrao)}`;

  return (
    <aside
      aria-label="Atendimento via WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2"
    >
      {mostrarTooltip && (
        <div
          role="status"
          className="bg-white text-slate-800 text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl border border-purple-100 flex items-center gap-2 max-w-[260px] animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <span className="flex-1 leading-snug">
            Precisa de ajuda ou prefere falar diretamente com a gestão?
          </span>
          <button
            type="button"
            onClick={() => setMostrarTooltip(false)}
            className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            aria-label="Fechar balão informativo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="relative group">
        <a
          href={urlWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setMostrarTooltip(true)}
          className="flex items-center gap-2.5 bg-[#25D366] hover:bg-[#20bd5a] text-white px-4 py-3 rounded-full shadow-lg shadow-green-600/30 transition-all transform hover:scale-105 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-green-400/40"
          aria-label="Falar com a Clínica Viver Mais no WhatsApp"
        >
          <div className="relative">
            <MessageCircle className="w-6 h-6 fill-current" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
            </span>
          </div>
          <span className="hidden sm:inline font-black text-xs tracking-tight">
            Fale Conosco
          </span>
        </a>
      </div>
    </aside>
  );
}

'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 448 512" aria-hidden="true" className={className} fill="currentColor">
      <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.8l-6.7-4-69.8 18.3L72 359.1l-4.4-7c-18.5-29.4-28.2-63.4-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.7-186.6 184.7zm101.2-138.3c-5.5-2.8-32.8-16.1-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8s-14.3 18-17.6 21.8c-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3s19.9 53.7 22.6 57.4c2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
    </svg>
  );
}

interface FloatingWhatsAppButtonProps {
  numeroTelefone?: string;
  mensagemPadrao?: string;
}

const NUMERO_PADRAO_CLINICA = process.env.NEXT_PUBLIC_WHATSAPP_CLINICA || '554898315675';

export default function FloatingWhatsAppButton({
  numeroTelefone = NUMERO_PADRAO_CLINICA,
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
            <WhatsAppIcon className="h-6 w-6" />
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

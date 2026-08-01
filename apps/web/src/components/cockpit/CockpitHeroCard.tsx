'use client';

import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Video, CheckCircle2 } from 'lucide-react';

export function CockpitHeroCard() {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-psi-darkest text-white shadow-contrast min-h-[340px] flex flex-col justify-between items-end">
      {/* Background Image realocada 30% para baixo (object-[center_70%]) */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/vivermaispsicologiaclinic.jpg"
          alt="Viver Mais Psicologia Clínica"
          fill
          className="object-cover object-[center_70%] opacity-90"
          priority
        />
        {/* Degradê forte e opaco no lado direito onde estão os textos para contraste total */}
        <div className="absolute inset-0 bg-gradient-to-l from-[#43265E] via-[#43265E]/95 via-45% to-transparent z-10" />
      </div>

      {/* Conteúdo Principal do Card Hero (Alinhado à Direita) */}
      <div className="relative z-20 p-8 max-w-xl space-y-4 text-right flex flex-col items-end">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight tracking-tight drop-shadow-md">
          Você pronto para o próximo nível da psicologia clínica.
        </h1>

        <p className="text-xs sm:text-sm text-psi-soft font-medium leading-relaxed drop-shadow-sm">
          Assine o Viver Mais e desbloqueie uma nova jornada de automação de prontuários SOAP, atendimento Zoom-Like e inteligência em 1-clique.
        </p>

        {/* Recursos com Checkmarks alinhados à direita */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs text-psi-soft font-medium text-right w-full">
          <div className="flex items-center justify-end space-x-2">
            <span>Aplicação de escalas psicométricas</span>
            <CheckCircle2 className="w-4 h-4 text-psi-vibrant shrink-0" />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <span>Atendimento de telepsicoterapia ao vivo</span>
            <CheckCircle2 className="w-4 h-4 text-psi-vibrant shrink-0" />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <span>Elaboração de prontuários com IA SOAP</span>
            <CheckCircle2 className="w-4 h-4 text-psi-vibrant shrink-0" />
          </div>
          <div className="flex items-center justify-end space-x-2">
            <span>Evolução contínua da prática clínica</span>
            <CheckCircle2 className="w-4 h-4 text-psi-vibrant shrink-0" />
          </div>
        </div>

        {/* Botões de Ação Rápida */}
        <div className="flex items-center justify-end space-x-3 pt-3">
          <Link
            href="/sessao/demo"
            className="px-5 py-3 bg-psi-vibrant hover:bg-psi-deep text-white font-bold text-xs rounded-xl shadow-lg shadow-psi-vibrant/30 transition-all flex items-center space-x-2"
          >
            <Video className="w-4 h-4" />
            <span>Iniciar Sessão Zoom</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

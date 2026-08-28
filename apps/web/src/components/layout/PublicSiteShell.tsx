'use client';

import React from 'react';
import PublicHeader, { PublicNavModo } from './PublicHeader';
import PublicFooter from './PublicFooter';
import FloatingWhatsAppButton from './FloatingWhatsAppButton';

interface PublicSiteShellProps {
  modoAtivo?: PublicNavModo;
  onSelecionarModo?: (modo: PublicNavModo) => void;
  onAgendarClick?: () => void;
  onCredenciarClick?: () => void;
  whatsappNumero?: string;
  whatsappMensagem?: string;
  children: React.ReactNode;
}

export default function PublicSiteShell({
  modoAtivo = 'PACIENTE',
  onSelecionarModo,
  onAgendarClick,
  onCredenciarClick,
  whatsappNumero,
  whatsappMensagem,
  children,
}: PublicSiteShellProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-purple-100 selection:text-purple-900 flex flex-col justify-between">
      <PublicHeader
        modoAtivo={modoAtivo}
        onSelecionarModo={onSelecionarModo}
        onAgendarClick={onAgendarClick}
        onCredenciarClick={onCredenciarClick}
      />

      <main className="flex-1 w-full">{children}</main>

      <FloatingWhatsAppButton
        numeroTelefone={whatsappNumero}
        mensagemPadrao={whatsappMensagem}
      />

      <PublicFooter
        onIrParaAgendar={onAgendarClick}
        onIrParaCadastroPsicologo={onCredenciarClick}
      />
    </div>
  );
}

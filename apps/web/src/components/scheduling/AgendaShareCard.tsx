'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Share2 } from 'lucide-react';

interface Props {
  token?: string;
  professionalName?: string;
}

/**
 * O link permanente de marcação, pronto para ir ao WhatsApp do paciente.
 *
 * É permanente de propósito: o profissional manda uma vez e o paciente reusa a
 * cada semana. Um link por sessão obrigaria a um envio novo toda vez — e é
 * justamente a conversa de remarcação que a agenda deveria evitar.
 */
export function AgendaShareCard({ token, professionalName }: Props) {
  const [copiado, setCopiado] = useState(false);
  const link = token ? `${window.location.origin}/agendar/${token}` : '';

  const copiar = async () => {
    await navigator.clipboard.writeText(link);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2500);
  };

  const compartilhar = () => {
    const texto = encodeURIComponent(
      `Olá! Use este link para marcar sua sessão com ${professionalName ?? 'seu psicólogo'}. É só informar seu CPF e escolher o dia e o horário:\n${link}`
    );
    window.open(`https://wa.me/?text=${texto}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="bg-psi-darkest text-white p-6 rounded-3xl space-y-4 shadow-contrast">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-black flex items-center gap-2">
            <Link2 className="w-4 h-4 text-psi-soft" /> Link de agendamento
          </h2>
          <p className="text-xs text-white/70 mt-1">
            O paciente informa o CPF, o sistema reconhece o cadastro dele com você e mostra só os
            horários livres da sua grade.
          </p>
        </div>
        {token && (
          <a href={link} target="_blank" rel="noreferrer" aria-label="Abrir link de agendamento" className="shrink-0 text-white/70 hover:text-white">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>

      <div className="truncate rounded-xl border border-white/20 bg-black/20 px-3 py-2 text-[11px] font-mono text-psi-soft">
        {token ? link : 'Carregando…'}
      </div>

      <div className="flex gap-2">
        <button type="button" disabled={!token} onClick={() => void copiar()} className="flex-1 rounded-xl bg-white p-2.5 text-xs font-black text-psi-darkest flex justify-center items-center gap-1.5 disabled:opacity-50">
          {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" disabled={!token} onClick={compartilhar} className="flex-1 rounded-xl bg-white/15 p-2.5 text-xs font-bold flex justify-center items-center gap-1.5 disabled:opacity-50 hover:bg-white/25">
          <Share2 className="w-4 h-4" /> WhatsApp
        </button>
      </div>
    </section>
  );
}

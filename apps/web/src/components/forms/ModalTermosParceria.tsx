'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, FileCheck2, ShieldCheck, X } from 'lucide-react';
import { TermoAdesaoDocument } from '@/components/forms/TermoAdesaoDocument';
import { TERMO_ADESAO_TITULO, VERSAO_TERMO_ADESAO } from '@/components/forms/termoAdesaoContent';

interface ModalTermosParceriaProps {
  isOpen: boolean;
  onClose: () => void;
  onAceitar: () => void;
  jaAceito?: boolean;
}

export const VERSAO_TERMOS_PARCERIA = VERSAO_TERMO_ADESAO;

export function ModalTermosParceria({
  isOpen,
  onClose,
  onAceitar,
  jaAceito = false,
}: ModalTermosParceriaProps) {
  const [leuNestaAbertura, setLeuNestaAbertura] = useState(false);
  const [progresso, setProgresso] = useState(jaAceito ? 100 : 0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rolouAteOFim = jaAceito || leuNestaAbertura;

  useEffect(() => {
    if (!isOpen) return;

    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    const timer = window.setTimeout(() => {
      const el = scrollRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 20) {
        setLeuNestaAbertura(true);
        setProgresso(100);
      }
    }, 100);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = overflowAnterior;
      setLeuNestaAbertura(false);
      setProgresso(jaAceito ? 100 : 0);
    };
  }, [isOpen, jaAceito, onClose]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const distanciaRolavel = el.scrollHeight - el.clientHeight;
    const percentual = distanciaRolavel <= 0
      ? 100
      : Math.min(100, Math.round((el.scrollTop / distanciaRolavel) * 100));
    setProgresso(percentual);
    if (percentual >= 99) setLeuNestaAbertura(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-psi-darkest/80 p-0 backdrop-blur-sm sm:p-5" role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="termo-adesao-titulo"
        className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[94dvh] sm:max-w-5xl sm:rounded-3xl sm:border sm:border-psi-soft"
      >
        <div className="relative border-b border-psi-soft bg-white px-4 py-4 sm:px-6 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-psi-darkest text-white shadow-md shadow-psi-darkest/20">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-psi-vibrant">
                  Documento jurídico · Versão {VERSAO_TERMOS_PARCERIA}
                </span>
                <h1 id="termo-adesao-titulo" className="truncate text-sm font-black text-ink sm:text-lg">
                  {TERMO_ADESAO_TITULO}
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-muted transition-colors hover:bg-psi-light hover:text-ink"
              aria-label="Fechar termo"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-1 bg-psi-soft" aria-hidden="true">
            <div
              className="h-full bg-gradient-to-r from-psi-vibrant to-psi-deep transition-[width] duration-150"
              style={{ width: `${progresso}%` }}
            />
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="min-h-0 flex-1 overflow-y-auto bg-[#FCFAFD] px-4 py-7 sm:px-8 sm:py-9"
        >
          <TermoAdesaoDocument />
        </div>

        <div className="border-t border-psi-soft bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-col items-stretch justify-between gap-3 sm:flex-row sm:items-center">
            {!rolouAteOFim ? (
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-700 sm:justify-start">
                <ChevronDown className="h-4 w-4 animate-bounce" />
                <span>Continue a leitura · {progresso}% concluído</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs font-extrabold text-emerald-700 sm:justify-start">
                <FileCheck2 className="h-4 w-4" />
                <span>Leitura completa confirmada</span>
              </div>
            )}

            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-outline flex-1 px-4 py-2.5 text-xs sm:flex-none">
                Fechar
              </button>
              <button
                type="button"
                disabled={!rolouAteOFim}
                onClick={() => {
                  onAceitar();
                  onClose();
                }}
                className="btn-primary flex-1 px-5 py-2.5 text-xs sm:flex-none"
              >
                <Check className="h-4 w-4" />
                Li e Aceito os Termos
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

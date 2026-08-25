'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import type { CertificateRecord } from '@thats-life/core';
import { CertificateDocumentView } from '@/components/certificados/CertificateDocumentView';

type State =
  | { phase: 'loading' }
  | { phase: 'found'; record: CertificateRecord }
  | { phase: 'not-found' }
  | { phase: 'error' };

export function PublicCertificateValidation({ code }: { code: string }) {
  const [state, setState] = useState<State>({ phase: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    fetch(`/api/public/certificados/validar/${encodeURIComponent(code)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) return setState({ phase: 'not-found' });
        if (!response.ok) return setState({ phase: 'error' });

        const body = (await response.json()) as { ok?: boolean; data?: CertificateRecord };
        setState(body.ok && body.data ? { phase: 'found', record: body.data } : { phase: 'not-found' });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({ phase: 'error' });
      });

    return () => controller.abort();
  }, [code]);

  if (state.phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#F9F5FC] grid place-items-center p-4 text-muted">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 className="h-5 w-5 animate-spin text-psi-vibrant" />
          Consultando autenticidade do certificado…
        </div>
      </div>
    );
  }

  if (state.phase === 'found') {
    const publicUrl = `https://www.vivermaispsicologia.com.br/validar-certificado/${encodeURIComponent(state.record.code)}`;
    return (
      <div className="min-h-screen bg-[#F9F5FC] text-ink py-6 sm:py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="no-print flex items-center justify-between">
            <Link href="/validar-certificado" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted hover:text-psi-deep transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Consultar outro certificado</span>
            </Link>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-mono font-bold text-emerald-900 shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Código Oficial: {state.record.code}</span>
            </div>
          </div>
          <CertificateDocumentView record={state.record} publicValidationUrl={publicUrl} />
        </div>
      </div>
    );
  }

  const unavailable = state.phase === 'error';
  return (
    <div className="min-h-screen bg-[#F9F5FC] text-ink py-16 px-4">
      <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-8 text-center shadow-card space-y-5">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-red-100 text-red-600">
          <XCircle className="w-8 h-8" />
        </div>
        <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-bold uppercase tracking-wider">
          {unavailable ? 'Status: Indisponível' : 'Status: Não Encontrado'}
        </span>
        <h1 className="font-heading text-2xl font-black text-red-950">
          {unavailable ? 'Consulta Indisponível' : 'Certificado Não Localizado'}
        </h1>
        <p className="text-xs sm:text-sm text-muted leading-relaxed">
          {unavailable ? 'Não foi possível consultar o registro neste momento. Tente novamente em alguns instantes.' : <>Nenhum certificado ativo foi localizado para o código <code className="font-mono font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200">{code}</code>. Verifique se o código foi digitado corretamente ou consulte a Secretaria de Cursos.</>}
        </p>
        <div className="pt-2">
          <Link href="/validar-certificado" className="btn-primary w-full py-3 text-xs font-bold">
            <ArrowLeft className="w-4 h-4" />
            Digitar Outro Código
          </Link>
        </div>
      </div>
    </div>
  );
}

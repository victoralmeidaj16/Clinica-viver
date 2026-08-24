'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Award, CheckCircle2, KeyRound, Search, ShieldCheck, XCircle } from 'lucide-react';

export default function ValidarCertificadoHomePage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string>();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = codigo.trim();
    if (!token) {
      setErro('Por favor, digite o código do certificado.');
      return;
    }
    router.push(`/validar-certificado/${encodeURIComponent(token)}`);
  };

  return (
    <div className="min-h-screen bg-[#F9F5FC] text-ink py-12 px-4 sm:px-6">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Header Institucional */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-psi-soft text-psi-deep text-xs font-bold border border-psi-vibrant/20 shadow-xs mb-1">
            <Award className="w-4 h-4 text-psi-vibrant" />
            <span>Secretaria Acadêmica · Viver Mais Psicologia</span>
          </div>

          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Portal de Validação de Certificados
          </h1>

          <p className="text-sm text-muted max-w-lg mx-auto leading-relaxed">
            Consulte a autenticidade, carga horária e validade oficial de certificados e formações emitidos pela Viver Mais Psicologia.
          </p>
        </div>

        {/* Card de Busca por Código */}
        <div className="rounded-3xl border border-line bg-white p-6 sm:p-8 shadow-card space-y-6">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label htmlFor="codigo" className="block text-xs font-bold uppercase tracking-wider text-ink mb-2">
                Código Único de Validação
              </label>

              <div className="relative flex items-center">
                <input
                  id="codigo"
                  type="text"
                  className="w-full px-4 py-3.5 border border-line rounded-2xl font-mono text-base font-bold text-psi-deep tracking-wider focus:outline-none focus:ring-2 focus:ring-psi-vibrant/30 focus:border-psi-vibrant uppercase placeholder:font-normal placeholder:normal-case placeholder:text-muted/60"
                  placeholder="Ex: yZV8anjS ou VVR-DEMO-2026"
                  value={codigo}
                  onChange={(e) => {
                    setCodigo(e.target.value);
                    setErro(undefined);
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />

                {codigo && (
                  <button
                    type="button"
                    onClick={() => setCodigo('')}
                    className="absolute right-3.5 text-muted hover:text-ink text-xs font-bold px-2 py-1 rounded-lg hover:bg-psi-soft transition-colors"
                  >
                    ✕ Limpar
                  </button>
                )}
              </div>

              {erro && <p className="text-xs font-semibold text-coral mt-2">{erro}</p>}

              <p className="text-[11px] text-muted mt-2 leading-relaxed">
                O código de 8 ou mais caracteres fica impresso no rodapé do verso do certificado (carimbo digital) ou sob o QR Code.
              </p>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-psi-deep hover:bg-psi-darkest text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-psi-deep/20 transition-all active:scale-[0.99]"
            >
              <Search className="w-4 h-4" />
              Consultar Autenticidade do Certificado
            </button>
          </form>

          {/* Códigos de Exemplo para Teste Rápido */}
          <div className="pt-6 border-t border-line/60 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-psi-vibrant" />
              Testar Códigos de Demonstração:
            </p>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/validar-certificado/yZV8anjS"
                className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-mono font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>yZV8anjS (Pós-Graduação 360h)</span>
              </Link>

              <Link
                href="/validar-certificado/VVR-DEMO-2026"
                className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-900 text-xs font-mono font-bold border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>VVR-DEMO-2026 (Formação 120h)</span>
              </Link>

              <Link
                href="/validar-certificado/VVR-TEST-3390"
                className="px-3 py-2 rounded-xl bg-purple-50 text-purple-900 text-xs font-mono font-bold border border-purple-200 hover:bg-purple-100 transition-colors flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                <span>VVR-TEST-3390 (Psicofarmacologia 40h)</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Rodapé de Segurança e Compliance */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-muted">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Validação assinada eletronicamente com carimbo digital contra adulteração.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Pagamento seguro — Viver Mais Psicologia',
  description: 'Pague sua sessão de psicoterapia por Pix ou cartão de crédito.',
};

/**
 * Moldura das telas públicas de pagamento.
 *
 * Cabeçalho e rodapé são idênticos na escolha da modalidade e no checkout; com
 * a divisão do link em dois endereços, mantê-los copiados nas duas telas seria
 * a garantia de que uma hora as marcas divergem.
 */
export default function PagarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 lg:p-8 font-sans selection:bg-emerald-500 selection:text-white">
      <header className="max-w-xl w-full mx-auto flex items-center justify-between py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-slate-950 text-base shadow-lg shadow-emerald-500/20">
            Ψ
          </div>
          <div>
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase block">
              Viver Mais Psicologia
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Pagamento Seguro</span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <ShieldCheck className="w-3.5 h-3.5" />
          Checkout Verificado
        </span>
      </header>

      <main className="max-w-xl w-full mx-auto my-8">{children}</main>

      <footer className="max-w-xl w-full mx-auto text-center py-4 border-t border-slate-800 text-[11px] text-slate-500">
        Viver Mais Psicologia. Pagamentos processados com segurança via Asaas.
      </footer>
    </div>
  );
}

import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import PublicBrandShell from '@/components/layout/PublicBrandShell';

export const metadata: Metadata = {
  title: 'Pagamento seguro — Viver Mais Psicologia',
  description: 'Pague sua sessão de psicoterapia por Pix ou cartão de crédito.',
};

export default function PagarLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicBrandShell
      subtitulo="Pagamento seguro"
      selo={
        <>
          <ShieldCheck className="w-3.5 h-3.5" />
          Checkout verificado
        </>
      }
      rodape="Viver Mais Psicologia · Pagamentos processados com segurança via Asaas."
    >
      {children}
    </PublicBrandShell>
  );
}

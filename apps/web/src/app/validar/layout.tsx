import type { Metadata } from 'next';
import { ShieldCheck } from 'lucide-react';
import PublicBrandShell from '@/components/layout/PublicBrandShell';

export const metadata: Metadata = {
  title: 'Conferir declaração — Viver Mais Psicologia',
  description:
    'Confira a autenticidade de uma declaração de horas de atendimento emitida pela Viver Mais Psicologia.',
  // A conferência é endereçada por um código impresso num documento de outra
  // pessoa: não há por que aparecer em busca.
  robots: { index: false, follow: false },
};

/** Mesma moldura do checkout e da agenda: quem chega de fora vê a marca. */
export default function ValidarLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicBrandShell
      subtitulo="Conferência de declaração"
      selo={
        <>
          <ShieldCheck className="w-3.5 h-3.5" />
          Documento verificado
        </>
      }
      rodape="Viver Mais Psicologia · CNPJ 19.440.737/0001-53 · Tubarão/SC"
    >
      {children}
    </PublicBrandShell>
  );
}

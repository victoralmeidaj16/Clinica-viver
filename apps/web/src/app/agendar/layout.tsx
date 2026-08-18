import type { Metadata } from 'next';
import { CalendarCheck } from 'lucide-react';
import PublicBrandShell from '@/components/layout/PublicBrandShell';

export const metadata: Metadata = {
  title: 'Agendar sessão — Viver Mais Psicologia',
  description: 'Escolha o dia e o horário da sua sessão de psicoterapia.',
};

/** Mesma moldura do checkout: quem recebe os dois links vê uma marca só. */
export default function AgendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <PublicBrandShell
      subtitulo="Agendamento de sessão"
      selo={
        <>
          <CalendarCheck className="w-3.5 h-3.5" />
          Agenda verificada
        </>
      }
      rodape="Viver Mais Psicologia · Seus dados são usados apenas para localizar seu cadastro."
    >
      {children}
    </PublicBrandShell>
  );
}

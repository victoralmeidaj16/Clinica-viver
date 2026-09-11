import type { Metadata } from 'next';
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
      rodape="Viver Mais Psicologia · Seus dados são usados apenas para localizar seu cadastro."
    >
      {children}
    </PublicBrandShell>
  );
}

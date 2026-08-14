import type { Metadata } from 'next';
import { CalendarCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Agendar sessão — Viver Mais Psicologia',
  description: 'Escolha o dia e o horário da sua sessão de psicoterapia.',
};

/** Mesma moldura do checkout público: quem recebe os dois links vê uma marca só. */
export default function AgendarLayout({ children }: { children: React.ReactNode }) {
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
            <span className="text-[10px] text-slate-400 font-medium">Agendamento de sessão</span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CalendarCheck className="w-3.5 h-3.5" />
          Agenda Verificada
        </span>
      </header>

      <main className="max-w-xl w-full mx-auto my-8">{children}</main>

      <footer className="max-w-xl w-full mx-auto text-center py-4 border-t border-slate-800 text-[11px] text-slate-500">
        Viver Mais Psicologia. Seus dados são usados apenas para localizar seu cadastro.
      </footer>
    </div>
  );
}

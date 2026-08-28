import { Brain } from 'lucide-react';
import FloatingWhatsAppButton from './FloatingWhatsAppButton';

/**
 * Moldura das páginas públicas — checkout e agendamento.
 *
 * Estas telas são a única parte do sistema que o paciente vê, e chegam a ele
 * por um link solto no WhatsApp: se não parecerem a clínica, parecem golpe.
 * Por isso usam a mesma marca do app — o roxo `psi` sobre o canvas claro, e o
 * mesmo bloco de identidade do menu lateral — em vez de um tema próprio.
 *
 * A moldura é uma só, compartilhada pelos dois layouts, porque cabeçalho
 * duplicado é cabeçalho que uma hora diverge.
 */
export default function PublicBrandShell({
  subtitulo,
  selo,
  rodape,
  children,
}: {
  /** Linha sob a marca: diz ao paciente em que fluxo ele está. */
  subtitulo: string;
  selo: React.ReactNode;
  rodape: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col justify-between p-4 sm:p-6 lg:p-8 selection:bg-psi-soft selection:text-psi-darkest">
      <header className="max-w-xl w-full mx-auto flex items-center justify-between gap-3 py-4 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-psi-vibrant text-white flex items-center justify-center shrink-0 shadow-md">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-sm text-ink leading-none tracking-tight flex items-center gap-1">
              Viver Mais
              <span className="text-white text-[10px] font-black px-1.5 py-0.5 rounded-md bg-psi-vibrant">
                Psi
              </span>
            </h1>
            <p className="text-[10px] text-muted font-semibold mt-1">{subtitulo}</p>
          </div>
        </div>

        <span className="chip-accent text-[11px] whitespace-nowrap">{selo}</span>
      </header>

      <main className="max-w-xl w-full mx-auto my-8 flex-1">{children}</main>

      <FloatingWhatsAppButton />

      <footer className="max-w-xl w-full mx-auto text-center py-4 border-t border-line text-[11px] text-muted">
        {rodape}
      </footer>
    </div>
  );
}

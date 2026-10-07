import { Compass, Download, HelpCircle, ShieldCheck } from 'lucide-react';
import { ETAPAS } from '@/lib/ajuda/etapas';
import AjudaEtapa from '@/components/ajuda/AjudaEtapa';
import { AjudaBussola, AjudaIndice, AjudaRegras } from '@/components/ajuda/AjudaConsulta';

export const metadata = { title: 'Ajuda — Viver Mais Psicologia' };

/**
 * Manual de uso do psicólogo dentro da plataforma. É o mesmo conteúdo do PDF
 * oferecido para download no topo da página.
 */
export default function AjudaPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <span className="chip">Manual do Psicólogo</span>
          <h1 className="mt-3 flex items-center gap-2 text-2xl font-black text-ink">
            <HelpCircle className="h-6 w-6 text-psi-vibrant" /> Ajuda
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Escolha a etapa abaixo. Em cada print, o círculo laranja numerado mostra onde clicar — o número é o mesmo do passo.
          </p>
        </div>
        <a href="/ajuda/manual-pratico-psicologo.pdf" download className="btn-outline text-xs">
          <Download className="h-4 w-4" /> Baixar manual em PDF
        </a>
      </div>

      <AjudaIndice />

      <section id="bussola" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-psi-darkest">
          <Compass className="h-5 w-5 text-psi-vibrant" /> Preciso fazer algo agora
        </h2>
        <AjudaBussola />
      </section>

      {ETAPAS.map((etapa) => <AjudaEtapa key={etapa.id} etapa={etapa} />)}

      <section id="regras" className="scroll-mt-24 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-black text-psi-darkest">
          <ShieldCheck className="h-5 w-5 text-psi-vibrant" /> Regras de ouro
        </h2>
        <AjudaRegras />
      </section>
    </div>
  );
}

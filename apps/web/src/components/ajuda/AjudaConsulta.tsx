import { ArrowRight } from 'lucide-react';
import { ETAPAS } from '@/lib/ajuda/etapas';
import { BUSSOLA, REGRAS_DE_OURO } from '@/lib/ajuda/consulta';
import TextoRico from '@/components/ajuda/TextoRico';

const numero = (n: number) => String(n).padStart(2, '0');

/** Sumário visual: cada cartão salta para a etapa na própria página. */
export function AjudaIndice() {
  return (
    <nav aria-label="Etapas da ajuda" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {ETAPAS.map((etapa) => {
        const Icone = etapa.icone;
        return (
          <a key={etapa.id} href={`#${etapa.id}`} className="group flex items-center gap-3 rounded-2xl border border-psi-soft/60 bg-surface p-3 shadow-card transition hover:border-psi-vibrant/50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-psi-deep text-white">
              <Icone className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-psi-vibrant">Etapa {numero(etapa.numero)}</span>
              <span className="block truncate text-sm font-bold text-psi-darkest">{etapa.titulo}</span>
            </span>
          </a>
        );
      })}
    </nav>
  );
}

const numeroDaEtapa = (id?: string) => ETAPAS.find((etapa) => etapa.id === id)?.numero;

export function AjudaBussola() {
  return (
    <div className="grid gap-2.5 md:grid-cols-2">
      {BUSSOLA.map((atalho) => {
        const Icone = atalho.icone;
        const etapa = numeroDaEtapa(atalho.etapa);
        const conteudo = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-psi-deep text-white"><Icone className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-psi-darkest">{atalho.situacao}</span>
              <span className="block text-xs text-ink/80"><TextoRico texto={atalho.onde} /></span>
            </span>
            {etapa && (
              <span className="flex shrink-0 items-center gap-1 rounded-full border border-psi-soft bg-white px-2.5 py-1 text-[10px] font-black text-psi-vibrant">
                Etapa {numero(etapa)} <ArrowRight className="h-3 w-3" />
              </span>
            )}
          </>
        );
        const classe = 'flex items-center gap-3 rounded-2xl border border-psi-soft/60 bg-psi-soft/20 p-3';
        return atalho.etapa
          ? <a key={atalho.situacao} href={`#${atalho.etapa}`} className={`${classe} transition hover:border-psi-vibrant/50`}>{conteudo}</a>
          : <div key={atalho.situacao} className={classe}>{conteudo}</div>;
      })}
    </div>
  );
}

export function AjudaRegras() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {REGRAS_DE_OURO.map((regra) => {
        const Icone = regra.icone;
        return (
          <div key={regra.titulo} className="flex gap-3 rounded-2xl border border-psi-soft/60 bg-surface p-4 shadow-card">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-psi-vibrant to-psi-deep text-white"><Icone className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-black text-psi-darkest">{regra.titulo}</span>
              <span className="block text-xs text-ink/80">{regra.texto}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

import Image from 'next/image';
import { AlertTriangle, Info, Lightbulb } from 'lucide-react';
import type { Bloco, Etapa } from '@/lib/ajuda/etapas';
import TextoRico from '@/components/ajuda/TextoRico';

/** Círculo laranja: o mesmo desenhado sobre os prints, para o passo bater com a imagem. */
function Marcador({ n }: { n: number | '•' }) {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-white bg-amber-500 text-[11px] font-black text-ink shadow">
      {n}
    </span>
  );
}

function BlocoEtapa({ bloco }: { bloco: Bloco }) {
  const imagens = bloco.imagens ?? [];
  const colunas = imagens.length > 1 && imagens.every((imagem) => imagem.altura > imagem.largura)
    ? 'sm:grid-cols-2'
    : '';
  return (
    <div className="space-y-4">
      {bloco.titulo && <h4 className="text-sm font-black text-psi-deep">{bloco.titulo}</h4>}
      {imagens.length > 0 && (
        <div className={`grid gap-4 ${colunas}`}>
          {imagens.map((imagem) => (
            <a
              key={imagem.src}
              href={imagem.src}
              target="_blank"
              rel="noreferrer"
              title="Abrir o print em tamanho real"
              className={`block overflow-hidden rounded-2xl border border-psi-soft bg-white shadow-card transition hover:shadow-lift ${
                imagem.largura < 400 ? 'max-w-[18rem]' : ''
              }`}
            >
              <Image src={imagem.src} alt={imagem.alt} width={imagem.largura} height={imagem.altura} className="h-auto w-full" sizes="(max-width: 1024px) 100vw, 900px" />
            </a>
          ))}
        </div>
      )}
      <ol className={`grid gap-2.5 ${bloco.passos.length >= 6 ? 'md:grid-cols-2' : ''}`}>
        {bloco.passos.map((passo, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-ink/90">
            <Marcador n={passo.n} />
            <span><TextoRico texto={passo.texto} /></span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Aviso({ tipo, texto }: { tipo: 'dica' | 'atencao'; texto: string }) {
  const dica = tipo === 'dica';
  const Icone = dica ? Lightbulb : AlertTriangle;
  return (
    <div className={`flex gap-3 rounded-2xl border p-4 text-sm ${dica ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
      <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${dica ? 'text-emerald-600' : 'text-amber-600'}`} />
      <p><strong className="block">{dica ? 'Dica' : 'Atenção'}</strong><TextoRico texto={texto} /></p>
    </div>
  );
}

export default function AjudaEtapa({ etapa }: { etapa: Etapa }) {
  const Icone = etapa.icone;
  return (
    <section id={etapa.id} className="scroll-mt-24 rounded-3xl border border-psi-soft/60 bg-surface p-5 shadow-card sm:p-7 space-y-5">
      <header className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-psi-vibrant to-psi-deep text-white shadow-md">
          <Icone className="h-6 w-6" />
        </span>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-psi-vibrant">Etapa {String(etapa.numero).padStart(2, '0')}</p>
          <h3 className="text-xl font-black text-psi-darkest">{etapa.titulo}</h3>
        </div>
      </header>

      <div className="rounded-r-2xl border-l-4 border-psi-vibrant bg-psi-soft/30 px-4 py-3 text-sm">
        <p className="text-xs font-black text-psi-deep">Para que serve?</p>
        <p className="mt-0.5 text-ink/90"><TextoRico texto={etapa.serve} /></p>
      </div>

      {etapa.comoAbrir && <p className="text-sm text-muted"><TextoRico texto={etapa.comoAbrir} /></p>}

      {etapa.blocos.map((bloco, i) => <BlocoEtapa key={i} bloco={bloco} />)}

      <div className="flex gap-3 rounded-2xl bg-psi-soft/50 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-psi-deep" />
        <p><strong className="text-psi-darkest">Por que fazer? </strong><TextoRico texto={etapa.porque} /></p>
      </div>

      {(etapa.dica || etapa.atencao) && (
        <div className="grid gap-3 md:grid-cols-2">
          {etapa.dica && <Aviso tipo="dica" texto={etapa.dica} />}
          {etapa.atencao && <Aviso tipo="atencao" texto={etapa.atencao} />}
        </div>
      )}
    </section>
  );
}

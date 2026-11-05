import { Building2, Scale } from 'lucide-react';
import {
  TERMO_ADESAO_CLAUSULAS,
  TERMO_ADESAO_HONORARIOS,
  TERMO_ADESAO_IDENTIFICACAO,
  TERMO_ADESAO_TITULO,
  TERMO_ADESAO_SUBTITULO,
  TERMO_ADESAO_PAINEL,
  TERMO_ADESAO_HONORARIOS_CABECALHOS,
} from '@/components/forms/termoAdesaoContent';

function ParagrafoJuridico({ texto }: { texto: string }) {
  const [inicio, ...resto] = texto.split(':');
  const temRotulo = resto.length > 0 && /^(?:\d+(?:\.\d+)*\.?|[a-c]\))\s/.test(inicio);

  if (!temRotulo) {
    return <p className="whitespace-pre-line">{texto}</p>;
  }

  return (
    <p className="whitespace-pre-line">
      <strong className="font-extrabold text-ink">{inicio}:</strong>
      {resto.join(':')}
    </p>
  );
}

function TabelaHonorarios() {
  return (
    <div className="overflow-x-auto rounded-2xl border border-psi-soft bg-white shadow-sm">
      <table className="w-full min-w-[620px] border-collapse text-left text-[11px]">
        <thead className="bg-psi-darkest text-white">
          <tr>
            {TERMO_ADESAO_HONORARIOS_CABECALHOS.map((texto) => <th key={texto} className="whitespace-pre-line px-2 py-2 font-extrabold">{texto}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-psi-soft">
          {TERMO_ADESAO_HONORARIOS.map((item, index) => (
            <tr key={item.servico} className={index % 2 === 0 ? 'bg-white' : 'bg-psi-light'}>
              <td className="px-2 py-2 font-bold text-ink">{item.servico}</td>
              <td className="px-2 py-2 text-center font-extrabold text-ink">{item.particular}</td>
              <td className="px-2 py-2 text-center font-extrabold text-ink">{item.social}</td>
              <td className="px-2 py-2 text-center font-bold text-psi-deep">{item.pacoteSocial}</td>
              <td className="px-2 py-2 text-center font-bold text-psi-deep">{item.pacoteParticular}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TermoAdesaoDocument() {
  return (
    <article className="w-full pb-2 text-[13px] leading-5 text-slate-600">
      <header className="mb-4 border-b border-psi-soft pb-3 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-psi-vibrant">
          Clínica Viver Mais Psicologia
        </p>
        <h2 className="mt-2 font-display text-xl font-bold leading-tight text-psi-darkest sm:text-2xl">
          {TERMO_ADESAO_TITULO}
        </h2>
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
          {TERMO_ADESAO_SUBTITULO}
        </p>
      </header>

      <section className="mb-4 rounded-xl border border-psi-soft bg-psi-light p-3">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-psi-deep shadow-sm">
            <Building2 className="h-4 w-4" />
          </span>
          <h3 className="font-extrabold text-ink">Identificação institucional e aceite digital</h3>
        </div>
        <div className="space-y-1">
          {TERMO_ADESAO_IDENTIFICACAO.map((paragrafo) => (
            <ParagrafoJuridico key={paragrafo} texto={paragrafo} />
          ))}
        </div>
      </section>

      <div className="space-y-4">
        {TERMO_ADESAO_CLAUSULAS.map((clausula) => (
          <section key={clausula.numero} className="scroll-mt-4">
            <div className="mb-2 flex items-start gap-2">
              <span className="mt-0.5 flex h-8 min-w-8 items-center justify-center rounded-xl bg-psi-deep text-[10px] font-black text-white shadow-sm">
                {clausula.numero}
              </span>
              <h3 className="pt-1 text-sm font-black uppercase tracking-[0.045em] text-psi-darkest sm:text-base">
                {clausula.titulo}
              </h3>
            </div>
            <div className="space-y-1">
              {clausula.paragrafos.map((paragrafo, index) => (
                <div key={paragrafo}>
                  <ParagrafoJuridico texto={paragrafo} />
                  {clausula.numero === '05' && index === 0 && (
                    <div className="mt-4"><TabelaHonorarios /></div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-4 whitespace-pre-line rounded-xl border border-psi-vibrant/30 bg-psi-light p-3 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-psi-deep text-white shadow-md shadow-psi-deep/20">
          <Scale className="h-5 w-5" />
        </div>
        {TERMO_ADESAO_PAINEL.map((texto) => <p key={texto} className="mt-2 text-xs leading-5">{texto}</p>)}
      </footer>
    </article>
  );
}

import { Building2, Scale, ShieldCheck } from 'lucide-react';
import {
  TERMO_ADESAO_CLAUSULAS,
  TERMO_ADESAO_HONORARIOS,
  TERMO_ADESAO_IDENTIFICACAO,
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
      <table className="w-full min-w-[720px] border-collapse text-left text-xs">
        <thead className="bg-psi-darkest text-white">
          <tr>
            <th className="w-[34%] px-4 py-3 font-extrabold">Serviço / Modalidade</th>
            <th className="px-4 py-3 text-center font-extrabold">Particular</th>
            <th className="px-4 py-3 text-center font-extrabold">Acessível / Social</th>
            <th className="px-4 py-3 text-center font-extrabold">Pacote social</th>
            <th className="px-4 py-3 text-center font-extrabold">Pacote particular</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-psi-soft">
          {TERMO_ADESAO_HONORARIOS.map((item, index) => (
            <tr key={item.servico} className={index % 2 === 0 ? 'bg-white' : 'bg-psi-light'}>
              <td className="px-4 py-3 font-bold text-ink">{item.servico}</td>
              <td className="px-4 py-3 text-center font-extrabold text-ink">{item.particular}</td>
              <td className="px-4 py-3 text-center font-extrabold text-ink">{item.social}</td>
              <td className="px-4 py-3 text-center font-bold text-psi-deep">10% de desconto</td>
              <td className="px-4 py-3 text-center font-bold text-psi-deep">10% de desconto</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TermoAdesaoDocument() {
  return (
    <article className="mx-auto max-w-3xl pb-4 text-[13px] leading-6 text-slate-600 sm:text-sm sm:leading-7">
      <header className="mb-8 border-b border-psi-soft pb-7 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-psi-vibrant">
          Clínica Viver Mais Psicologia
        </p>
        <h2 className="mt-3 font-display text-2xl font-bold leading-tight text-psi-darkest sm:text-3xl">
          Termo de Adesão e Condições de Uso da Plataforma Digital
        </h2>
        <p className="mt-2 text-xs font-bold uppercase tracking-wide text-muted">
          Ambiente do Profissional · Aceite eletrônico
        </p>
      </header>

      <section className="mb-9 rounded-3xl border border-psi-soft bg-psi-light p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-psi-deep shadow-sm">
            <Building2 className="h-4 w-4" />
          </span>
          <h3 className="font-extrabold text-ink">Identificação institucional e aceite digital</h3>
        </div>
        <div className="space-y-3">
          {TERMO_ADESAO_IDENTIFICACAO.map((paragrafo) => (
            <ParagrafoJuridico key={paragrafo} texto={paragrafo} />
          ))}
        </div>
      </section>

      <div className="space-y-9">
        {TERMO_ADESAO_CLAUSULAS.map((clausula) => (
          <section key={clausula.numero} className="scroll-mt-4">
            <div className="mb-4 flex items-start gap-3">
              <span className="mt-0.5 flex h-8 min-w-8 items-center justify-center rounded-xl bg-psi-deep text-[10px] font-black text-white shadow-sm">
                {clausula.numero}
              </span>
              <h3 className="pt-1 text-sm font-black uppercase tracking-[0.045em] text-psi-darkest sm:text-base">
                {clausula.titulo}
              </h3>
            </div>
            <div className="space-y-3 pl-0 sm:pl-11">
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

      <footer className="mt-10 rounded-3xl border border-psi-vibrant/30 bg-gradient-to-br from-psi-light to-white p-6 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl bg-psi-deep text-white shadow-md shadow-psi-deep/20">
          <Scale className="h-5 w-5" />
        </div>
        <h3 className="mt-3 font-extrabold text-psi-darkest">Painel de aceite digital</h3>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-muted">
          Este documento é aprovado eletronicamente no sistema da clínica. A confirmação individual fica gravada no histórico de acesso da conta do profissional no Ambiente do Profissional.
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-extrabold text-emerald-700">
          <ShieldCheck className="h-4 w-4" />
          Leitura completa confirmada ao final
        </div>
      </footer>
    </article>
  );
}

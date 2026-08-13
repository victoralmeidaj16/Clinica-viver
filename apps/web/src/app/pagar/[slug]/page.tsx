import Link from 'next/link';
import { ArrowRight, Check, User } from 'lucide-react';
import {
  MODALIDADES_PAGAMENTO,
  nomeDoSlug,
  reaisDeCentavos,
} from '@/lib/modalidadesPagamento';

/**
 * O endereço antigo, sem modalidade.
 *
 * Agora cada modalidade tem o seu link, mas quem já mandou `/pagar/<nome>` para
 * um paciente não vai desmandar: aqui o endereço continua válido e apenas pede
 * a escolha que o link específico já traz decidida. Some no dia em que ninguém
 * mais tiver o link antigo salvo na conversa.
 */

export default async function EscolherModalidadePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const nomeProfissional = nomeDoSlug(slug);

  return (
    <>
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden mb-6">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-700 border-2 border-emerald-500/30 flex items-center justify-center shadow-inner relative">
            <User className="w-8 h-8 text-emerald-400" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-800 flex items-center justify-center">
              <Check className="w-3 h-3 text-slate-950 font-black" />
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase">
              Profissional Habilitado
            </span>
            <h1 className="text-xl font-black text-white">{nomeProfissional}</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Atendimento Clínico</p>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6 space-y-4 shadow-xl">
        <div>
          <h2 className="text-base font-extrabold text-white">Qual sessão você vai pagar?</h2>
          <p className="text-xs text-slate-400 mt-1">
            Na dúvida, confirme o valor combinado com {nomeProfissional} antes de seguir.
          </p>
        </div>

        <div className="space-y-3">
          {MODALIDADES_PAGAMENTO.map((modalidade) => (
            <Link
              key={modalidade.slug}
              href={`/pagar/${slug}/${modalidade.slug}`}
              className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/50 border border-slate-700/80 hover:border-emerald-500 hover:bg-emerald-500/10 transition-all group"
            >
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider block text-emerald-400 mb-0.5">
                  {modalidade.rotulo}
                </span>
                <span className="text-lg font-black text-white">
                  {reaisDeCentavos(modalidade.valorCentavos)}
                </span>
                <p className="text-[11px] text-slate-400">{modalidade.descricao}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-slate-500 group-hover:text-emerald-400 transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

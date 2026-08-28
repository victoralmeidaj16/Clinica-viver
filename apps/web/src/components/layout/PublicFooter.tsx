import React from 'react';
import Link from 'next/link';
import { ShieldCheck, PhoneCall, Heart, Sparkles } from 'lucide-react';

interface PublicFooterProps {
  onIrParaAgendar?: () => void;
  onIrParaCadastroPsicologo?: () => void;
}

export default function PublicFooter({
  onIrParaAgendar,
  onIrParaCadastroPsicologo,
}: PublicFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-12 pb-8 px-4 sm:px-6 mt-16 transition-colors">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Banner de Apoio Emocional / CVV */}
        <div className="bg-purple-950/60 border border-purple-800/40 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-purple-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-900/80 text-purple-300 flex items-center justify-center shrink-0 border border-purple-700/50">
              <PhoneCall className="w-5 h-5 text-pink-400" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-white leading-tight">
                Precisa de ajuda imediata ou apoio emocional?
              </h2>
              <p className="text-[11px] text-purple-300/80 mt-0.5">
                Em caso de crise ou urgência, ligue para o <strong>CVV (Centro de Valorização da Vida) no 188</strong> ou procure um pronto atendimento.
              </p>
            </div>
          </div>
          <a
            href="tel:188"
            className="text-xs font-black bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-xl transition-all shadow-md shrink-0 flex items-center gap-1.5 self-stretch sm:self-auto justify-center"
          >
            Ligue 188 (Grátis)
          </a>
        </div>

        {/* Grid de Conteúdo do Rodapé */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Coluna 1: Marca & Missão */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-base font-black tracking-tight text-white">
                Viver Mais <span className="text-purple-400 font-extrabold text-xs">PSI</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Cuidado psicológico acessível, humanizado e baseado em evidências para o seu bem-estar integral.
            </p>
          </div>

          {/* Coluna 2: Para Você */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-pink-400" />
              <span>Para Você</span>
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={onIrParaAgendar}
                  className="hover:text-purple-300 transition-colors text-left"
                >
                  Agendar Consulta
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onIrParaAgendar}
                  className="hover:text-purple-300 transition-colors text-left"
                >
                  Psicoterapia Individual & Social
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onIrParaAgendar}
                  className="hover:text-purple-300 transition-colors text-left"
                >
                  Psicoterapia de Casal
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onIrParaAgendar}
                  className="hover:text-purple-300 transition-colors text-left"
                >
                  Avaliação Psicológica
                </button>
              </li>
            </ul>
          </div>

          {/* Coluna 3: Para Especialistas */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black text-white uppercase tracking-wider">
              Para Especialistas
            </h3>
            <ul className="space-y-1.5 text-xs text-slate-400">
              <li>
                <button
                  type="button"
                  onClick={onIrParaCadastroPsicologo}
                  className="hover:text-purple-300 transition-colors text-left"
                >
                  Credenciamento de Psicólogos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onIrParaCadastroPsicologo}
                  className="hover:text-purple-300 transition-colors text-left"
                >
                  Políticas e Parceria Clínica
                </button>
              </li>
              <li>
                <Link
                  href="/login"
                  className="hover:text-purple-300 transition-colors inline-flex items-center gap-1"
                >
                  Área Restrita / Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Coluna 4: Ética, Sigilo & Compliance */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
              <span>Ética & Sigilo</span>
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Atendimentos em estrita conformidade com o Código de Ética do Psicólogo (CFP) e proteção de dados pela LGPD.
            </p>
            <div className="pt-1">
              <span className="inline-block text-[10px] font-bold text-purple-300 bg-purple-900/40 border border-purple-700/50 px-2.5 py-1 rounded-lg">
                Atendimentos Online & Presencial
              </span>
            </div>
          </div>
        </div>

        {/* Linha Divisória e Copyright */}
        <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {currentYear} Clínica Viver Mais Psicologia. Todos os direitos reservados.</p>
          <p className="text-[11px] text-slate-400">
            Plataforma de Inteligência e Automação Clínica
          </p>
        </div>
      </div>
    </footer>
  );
}

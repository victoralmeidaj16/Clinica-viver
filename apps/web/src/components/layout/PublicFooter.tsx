import React from 'react';
import { ShieldCheck, Heart, Sparkles } from 'lucide-react';

interface PublicFooterProps {
  onIrParaAgendar?: () => void;
}

export default function PublicFooter({ onIrParaAgendar }: PublicFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 pt-12 pb-8 px-4 sm:px-6 mt-16 transition-colors">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Grid de Conteúdo do Rodapé */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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

          {/* Coluna 3: Ética, Sigilo & Compliance */}
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

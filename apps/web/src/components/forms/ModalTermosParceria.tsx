'use client';

import React, { useState, useRef, useEffect } from 'react';
import { FileText, Check, X, ShieldCheck, AlertCircle, ChevronDown } from 'lucide-react';

interface ModalTermosParceriaProps {
  isOpen: boolean;
  onClose: () => void;
  onAceitar: () => void;
  jaAceito?: boolean;
}

export const VERSAO_TERMOS_PARCERIA = '2026.1';

export function ModalTermosParceria({
  isOpen,
  onClose,
  onAceitar,
  jaAceito = false,
}: ModalTermosParceriaProps) {
  const [rolouAteOFim, setRolouAteOFim] = useState(jaAceito);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setRolouAteOFim(jaAceito);
      // Se já estava aceito ou se o conteúdo couber sem scroll
      setTimeout(() => {
        if (scrollRef.current) {
          const { scrollHeight, clientHeight } = scrollRef.current;
          if (scrollHeight <= clientHeight + 20) {
            setRolouAteOFim(true);
          }
        }
      }, 100);
    }
  }, [isOpen, jaAceito]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const tolerancia = 25;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - tolerancia) {
      setRolouAteOFim(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-purple-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="p-5 sm:p-6 border-b border-purple-50 flex items-center justify-between gap-4 bg-purple-50/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-md shadow-purple-600/20 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-700 block">
                Contrato & Diretrizes Éticas • Versão {VERSAO_TERMOS_PARCERIA}
              </span>
              <h3 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Termos e Políticas de Parceria Clínica
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-white transition-all"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Rolagem e Monitoramento de Leitura */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="p-6 overflow-y-auto space-y-6 text-xs text-slate-600 leading-relaxed font-sans"
        >
          <div className="bg-purple-50/60 p-4 rounded-2xl border border-purple-100 flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
            <p className="text-[11px] text-purple-950 font-medium leading-relaxed">
              Para validar o seu credenciamento e garantir a segurança jurídica e ética dos atendimentos,
              leia atentamente as diretrizes abaixo e <strong>role o documento até o final</strong> para habilitar o aceite.
            </p>
          </div>

          <section className="space-y-2">
            <h4 className="font-black text-sm text-slate-900">1. Objeto da Parceria</h4>
            <p>
              O presente termo estabelece as condições gerais de credenciamento e cooperação entre a{' '}
              <strong>Clínica Viver Mais Psicologia</strong> e o(a) <strong>Psicólogo(a) Credenciado(a)</strong>,
              visando o encaminhamento ético e a gestão de pacientes por meio da plataforma integrada.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-black text-sm text-slate-900">2. Registro Profissional e Conformidade Ética</h4>
            <p>
              O(A) profissional declara possuir inscrição ativa e regular junto ao respectivo{' '}
              <strong>Conselho Regional de Psicologia (CRP)</strong>, comprometendo-se a exercer sua atividade em estrita
              observância ao Código de Ética Profissional do Psicólogo, às resoluções do CFP/CRP e à legislação vigente.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-black text-sm text-slate-900">3. Compromisso de SLA e Primeiro Contato (24 Horas)</h4>
            <p>
              Ao receber a notificação de um novo encaminhamento via WhatsApp/plataforma, o(a) psicólogo(a) compromete-se
              a realizar o primeiro contato com o paciente dentro do prazo máximo de <strong>24 (vinte e quatro) horas</strong>.
            </p>
            <p className="text-slate-500">
              Caso o profissional não tenha disponibilidade na agenda ou não possa atender o caso por incompatibilidade técnica,
              deverá responder imediatamente com o comando <strong>ENCAMINHAR</strong> ou avisar a gestão, permitindo o
              redirecionamento ágil do paciente sem prejuízo ao acolhimento.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-black text-sm text-slate-900">4. Gestão de Agenda e Disponibilidade</h4>
            <p>
              O(A) psicólogo(a) possui total autonomia clínica e de horários, cabendo-lhe manter seus turnos e status de
              visibilidade sempre atualizados no sistema. Caso vá entrar em recesso, férias ou atingir a capacidade máxima de
              atendimento, o(a) profissional deverá <strong>pausar seu perfil no rodízio previamente</strong> pelo painel
              para evitar o envio indevido de novos pacientes.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-black text-sm text-slate-900">5. Modalidades e Valores de Atendimento</h4>
            <p>
              Os atendimentos realizados na modalidade <strong>Acessível/Social</strong> e <strong>Particular</strong> devem
              seguir rigorosamente os valores e condições pactuados com a clínica, sendo vedada a cobrança de valores divergentes
              sem a prévia anuência da coordenação.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-black text-sm text-slate-900">6. Sigilo Profissional e Proteção de Dados (LGPD)</h4>
            <p>
              Em cumprimento à <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong> e às normas do CFP,
              todos os dados pessoais e prontuários clínicos dos pacientes são estritamente sigilosos e de guarda protegida,
              sendo vedado seu compartilhamento com terceiros não autorizados.
            </p>
          </section>

          <section className="space-y-2">
            <h4 className="font-black text-sm text-slate-900">7. Rescisão e Desativação do Credenciamento</h4>
            <p>
              Qualquer das partes poderá rescindir a parceria a qualquer momento, mediante comunicação prévia. A clínica reserva-se
              o direito de pausar ou desativar o cadastro de profissionais em caso de reiterado descumprimento do prazo de 24h,
              recusa recorrente de pacientes sem justificativa prévia ou conduta em desacordo com as diretrizes da equipe.
            </p>
          </section>

          <div className="pt-4 border-t border-slate-100 text-[11px] text-slate-400 text-center">
            Clínica Viver Mais Psicologia • CNPJ e Diretrizes Clínicas em conformidade com o CFP
          </div>
        </div>

        {/* Rodapé com Botão Condicional */}
        <div className="p-4 sm:p-5 border-t border-purple-50 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3">
          {!rolouAteOFim ? (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 font-bold animate-pulse">
              <ChevronDown className="w-4 h-4 text-amber-600" />
              <span>Role o texto até o final para habilitar o botão de aceite</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>Leitura completa confirmada</span>
            </div>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white text-xs font-bold transition-all"
            >
              Fechar
            </button>
            <button
              type="button"
              disabled={!rolouAteOFim}
              onClick={() => {
                onAceitar();
                onClose();
              }}
              className="w-full sm:w-auto bg-purple-700 hover:bg-purple-800 disabled:opacity-40 disabled:cursor-not-allowed text-white font-extrabold text-xs px-5 py-2.5 rounded-xl transition-all shadow-md shadow-purple-700/20 flex items-center justify-center gap-1.5 shrink-0"
            >
              <Check className="w-4 h-4" />
              <span>Li e Aceito os Termos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

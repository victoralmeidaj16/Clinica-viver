import React from 'react';
import Link from 'next/link';
import { UserPlus, ShieldCheck, ExternalLink } from 'lucide-react';
import { CadastroExistenteNotice } from './CadastroExistenteNotice';
import { ModalTermosParceria } from './ModalTermosParceria';
import { useCadastroPsicologoForm } from './useCadastroPsicologoForm';
import { CadastroPsicologoDadosPessoais } from './CadastroPsicologoDadosPessoais';
import { CadastroPsicologoAcessibilidade } from './CadastroPsicologoAcessibilidade';
import { CadastroPsicologoFormacao } from './CadastroPsicologoFormacao';
import { CadastroPsicologoPreferencias } from './CadastroPsicologoPreferencias';

export interface CadastroPsicologoCriado {
  id: string;
  [chave: string]: unknown;
}

interface Props {
  /** Chamado depois que o POST de credenciamento retorna sucesso. */
  onSucesso: (cadastro: CadastroPsicologoCriado) => void | Promise<void>;
  /** Se ausente, o botão de voltar/fechar não é exibido. */
  onCancelar?: () => void;
  eyebrow?: string;
  titulo?: string;
  descricao?: string;
  labelCancelar?: string;
  labelEnviar?: string;
  /** Classe do cartão externo — a vitrine usa a largura da página, os modais da gestão a do overlay. */
  className?: string;
}

/**
 * Formulário completo de credenciamento de psicólogo — o mesmo da vitrine.
 * A gestão (cockpit e gestão de psicólogos) monta este componente dentro de um
 * modal para que exista uma única fonte de verdade dos campos exigidos no
 * cadastro; antes cada tela tinha uma versão reduzida com defaults próprios.
 */
export function CadastroPsicologoForm({
  onSucesso,
  onCancelar,
  eyebrow = 'Credenciamento Clínico',
  titulo = 'Faça seu cadastro para atender na Clínica Viver Mais',
  descricao,
  labelCancelar = 'Voltar',
  labelEnviar = 'ENVIAR CADASTRO DE PSICÓLOGO',
  className = 'max-w-xl mx-auto bg-white rounded-3xl p-6 sm:p-8 border border-purple-100 shadow-xl space-y-6 animate-in fade-in duration-300',
}: Props) {
  const form = useCadastroPsicologoForm(onSucesso);
  const { formPsicologo, setFormPsicologo, isSubmitting, cadastroExistente, modalTermosAberto,
    setModalTermosAberto, aceitouTermos, setAceitouTermos, handleSubmitPsicologo } = form;

  return (
    <div className={className}>
      <div className="flex items-center justify-between border-b border-purple-50 pb-4 gap-4">
        <div>
          <span className="text-[10px] text-purple-600 font-bold uppercase tracking-wider block">{eyebrow}</span>
          <h3 className="text-lg font-black text-slate-900">{titulo}</h3>
          {descricao && <p className="text-[11px] text-slate-500 mt-0.5">{descricao}</p>}
        </div>
        {onCancelar && (
          <button
            type="button"
            onClick={onCancelar}
            className="text-xs text-slate-500 hover:text-slate-900 hover:underline font-bold shrink-0"
          >
            {labelCancelar}
          </button>
        )}
      </div>

      <p className="text-sm text-slate-600">Já se cadastrou? <Link href="/redefinir-senha" className="font-bold text-purple-700 underline">Recupere seu acesso</Link> sem criar outro cadastro.</p>
      {cadastroExistente !== null && <CadastroExistenteNotice key={cadastroExistente} email={cadastroExistente} />}

      <form onSubmit={handleSubmitPsicologo} className="space-y-4 text-xs">
        <CadastroPsicologoDadosPessoais formPsicologo={formPsicologo} setFormPsicologo={setFormPsicologo}
          temNomeSocialPsicologo={form.temNomeSocialPsicologo} setTemNomeSocialPsicologo={form.setTemNomeSocialPsicologo} />
        <CadastroPsicologoAcessibilidade value={formPsicologo.acessibilidade}
          onChange={(acessibilidade) => setFormPsicologo((current) => ({ ...current, acessibilidade }))} />
        <CadastroPsicologoFormacao formPsicologo={formPsicologo} setFormPsicologo={setFormPsicologo}
          temSegundaPos={form.temSegundaPos} setTemSegundaPos={form.setTemSegundaPos}
          segundaPosGraduacao={form.segundaPosGraduacao} setSegundaPosGraduacao={form.setSegundaPosGraduacao} />
        <CadastroPsicologoPreferencias formPsicologo={formPsicologo} setFormPsicologo={setFormPsicologo} />

        {/* Termo de Adesão e Condições de Uso */}
        <div className="bg-purple-50/70 border border-purple-200 p-4 rounded-2xl space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
              <span className="font-extrabold text-xs text-purple-950">
                Termo de Adesão e Condições de Uso
              </span>
            </div>
            <button
              type="button"
              onClick={() => setModalTermosAberto(true)}
              className="text-xs text-purple-700 hover:text-purple-900 font-extrabold flex items-center gap-1 underline shrink-0"
            >
              <span>{aceitouTermos ? 'Rever termos' : 'Ler termos'}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>

          <label className="flex items-start gap-2.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={aceitouTermos}
              onChange={(e) => {
                if (e.target.checked && !aceitouTermos) {
                  setModalTermosAberto(true);
                } else {
                  setAceitouTermos(e.target.checked);
                }
              }}
              className="w-4 h-4 rounded border-purple-300 text-purple-700 focus:ring-purple-500 accent-purple-700 mt-0.5 cursor-pointer"
            />
            <span className="text-[11px] text-slate-700 font-medium leading-snug">
              Li e concordo com o{' '}
              <strong className="text-purple-900 font-bold">Termo de Adesão e Condições de Uso da Plataforma Digital</strong>,
              incluindo as condições operacionais, financeiras, éticas e de proteção de dados.
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-purple-700/25 transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
        >
          <UserPlus className="w-4 h-4" />
          {isSubmitting ? 'ENVIANDO…' : labelEnviar}
        </button>
      </form>

      {/* Modal de leitura obrigatória do Termo de Adesão */}
      <ModalTermosParceria
        isOpen={modalTermosAberto}
        onClose={() => setModalTermosAberto(false)}
        jaAceito={aceitouTermos}
        onAceitar={() => setAceitouTermos(true)}
      />
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import {
  LIMITE_PACIENTES_MAXIMO,
  LIMITE_PACIENTES_MINIMO,
  limitePacientesValido,
  mensagemLimitePacientesInvalido,
} from '@/lib/psychologistCapacity';
import {
  Lock,
  X,
  Send,
  GraduationCap,
  Sparkles,
  Users,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import {
  TURMAS_VIVER_MAIS,
  POS_GRADUACOES_VIVER_MAIS,
  SERVICOS_PRESTADOS,
  comValoresRegistrados,
} from '@/components/forms/opcoesPsicologo';

export interface SolicitacaoGestaoFormValues {
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
  servicosPrestados: string[];
  limitePacientesAtivos: number;
  justificativa?: string;
}

interface ModalSolicitacaoGestaoProps {
  dadosAtuais: {
    turmaViverMais?: string;
    posGraduacaoViverMais?: string;
    segundaPosGraduacao?: string;
    servicosPrestados?: string[];
    limitePacientesAtivos?: number;
  };
  solicitacaoPendente?: {
    turmaViverMais?: string;
    posGraduacaoViverMais?: string;
    segundaPosGraduacao?: string;
    servicosPrestados?: string[];
    limitePacientesAtivos?: number;
    justificativa?: string;
  };
  onEnviar: (valores: SolicitacaoGestaoFormValues) => Promise<void>;
  onCancelar: () => void;
}

export function ModalSolicitacaoGestao({
  dadosAtuais,
  solicitacaoPendente,
  onEnviar,
  onCancelar,
}: ModalSolicitacaoGestaoProps) {
  const [turmaViverMais, setTurmaViverMais] = useState(
    solicitacaoPendente?.turmaViverMais ?? dadosAtuais.turmaViverMais ?? ''
  );
  const [posGraduacaoViverMais, setPosGraduacaoViverMais] = useState(
    solicitacaoPendente?.posGraduacaoViverMais ?? dadosAtuais.posGraduacaoViverMais ?? ''
  );
  const [segundaPosGraduacao, setSegundaPosGraduacao] = useState(
    solicitacaoPendente?.segundaPosGraduacao ?? dadosAtuais.segundaPosGraduacao ?? ''
  );
  const [servicosPrestados, setServicosPrestados] = useState<string[]>([
    ...(solicitacaoPendente?.servicosPrestados ?? dadosAtuais.servicosPrestados ?? []),
  ]);
  const [limitePacientesAtivos, setLimitePacientesAtivos] = useState<number>(
    solicitacaoPendente?.limitePacientesAtivos ?? dadosAtuais.limitePacientesAtivos ?? 5
  );
  const [justificativa, setJustificativa] = useState(
    solicitacaoPendente?.justificativa ?? ''
  );

  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const alternarServico = (servico: string) => {
    setServicosPrestados((atuais) =>
      atuais.includes(servico) ? atuais.filter((s) => s !== servico) : [...atuais, servico]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (servicosPrestados.length === 0) {
      setErro('Selecione ao menos um serviço que você presta na clínica.');
      return;
    }

    if (!limitePacientesValido(limitePacientesAtivos)) {
      setErro(mensagemLimitePacientesInvalido());
      return;
    }

    setSalvando(true);
    try {
      await onEnviar({
        turmaViverMais: turmaViverMais.trim() || undefined,
        posGraduacaoViverMais: posGraduacaoViverMais.trim() || undefined,
        segundaPosGraduacao: segundaPosGraduacao.trim() || undefined,
        servicosPrestados,
        limitePacientesAtivos,
        justificativa: justificativa.trim() || undefined,
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível enviar a solicitação.');
      setSalvando(false);
    }
  };

  const campoClasse =
    'w-full px-3.5 py-2.5 border border-line rounded-xl focus:outline-none focus:border-psi-vibrant text-xs bg-surface font-medium';

  const chipClasse = (marcado: boolean) =>
    `cursor-pointer px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
      marcado
        ? 'bg-psi-soft border-psi-vibrant text-psi-deep shadow-xs'
        : 'bg-surface border-line text-muted hover:border-psi-soft'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-3xl border border-line bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line bg-psi-darkest px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-psi-vibrant/20 text-psi-vibrant border border-psi-vibrant/30">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold sm:text-lg">
                Solicitar Alteração à Gestão
              </h2>
              <p className="text-xs text-white/70">
                Itens acadêmicos e serviços homologados pela coordenação
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Aviso explicativo */}
        <div className="bg-psi-soft/50 border-b border-psi-vibrant/20 px-6 py-3 text-xs text-psi-deep font-semibold flex items-center gap-2">
          <FileCheck className="w-4 h-4 shrink-0 text-psi-vibrant" />
          <span>
            Os dados enviados serão analisados e homologados pela gestão da clínica antes de entrarem em vigor no rodízio.
          </span>
        </div>

        {erro && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{erro}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Turma e Pós */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-psi-vibrant" />
                Turma Viver Mais
              </label>
              <select
                value={turmaViverMais}
                onChange={(e) => setTurmaViverMais(e.target.value)}
                className={campoClasse}
              >
                <option value="">Selecione sua turma...</option>
                {TURMAS_VIVER_MAIS.map((t) => (
                  <option key={t} value={t}>
                    Turma {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-psi-vibrant" />
                Pós-graduação Principal
              </label>
              <select
                value={posGraduacaoViverMais}
                onChange={(e) => setPosGraduacaoViverMais(e.target.value)}
                className={campoClasse}
              >
                <option value="">Selecione a pós-graduação...</option>
                {POS_GRADUACOES_VIVER_MAIS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">
              Segunda Pós-graduação (Opcional)
            </label>
            <select
              value={segundaPosGraduacao}
              onChange={(e) => setSegundaPosGraduacao(e.target.value)}
              className={campoClasse}
            >
              <option value="">Nenhuma / Não possui</option>
              {POS_GRADUACOES_VIVER_MAIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Serviços que Presto */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-psi-vibrant" />
              Serviços que presto
            </label>
            <p className="text-[11px] text-muted mb-2">
              Selecione as modalidades clínicas que você está habilitado e deseja ofertar na clínica:
            </p>
            <div className="flex flex-wrap gap-2">
              {comValoresRegistrados(SERVICOS_PRESTADOS, servicosPrestados).map((servico) => (
                <label key={servico} className={chipClasse(servicosPrestados.includes(servico))}>
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={servicosPrestados.includes(servico)}
                    onChange={() => alternarServico(servico)}
                  />
                  {servico}
                </label>
              ))}
            </div>
          </div>

          {/* Limite de Pacientes */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-psi-vibrant" />
              Capacidade Desejada (Pacientes Ativos)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={LIMITE_PACIENTES_MINIMO}
                max={LIMITE_PACIENTES_MAXIMO}
                value={limitePacientesAtivos}
                onChange={(e) => setLimitePacientesAtivos(Number(e.target.value))}
                className="w-24 px-3.5 py-2.5 border border-line rounded-xl text-sm font-bold text-center bg-surface focus:outline-none focus:border-psi-vibrant"
              />
              <span className="text-xs text-muted">
                A gestão revisará a capacidade solicitada antes de aplicá-la.
              </span>
            </div>
          </div>

          {/* Justificativa / Observação */}
          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">
              Justificativa ou Observações para a Gestão (Opcional)
            </label>
            <textarea
              rows={3}
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Concluí o módulo de Avaliação Psicológica e gostaria de incluir no meu rodízio..."
              className={`${campoClasse} resize-none`}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-line">
            <button
              type="button"
              onClick={onCancelar}
              disabled={salvando}
              className="px-5 py-2.5 rounded-xl border border-line text-muted font-bold text-xs hover:bg-canvas hover:text-ink transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-psi-deep text-white font-extrabold text-xs shadow-md hover:bg-psi-darkest active:scale-95 transition-all disabled:opacity-60"
            >
              <Send className="h-4 w-4" />
              <span>{salvando ? 'Enviando solicitação…' : 'Enviar Solicitação à Gestão'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

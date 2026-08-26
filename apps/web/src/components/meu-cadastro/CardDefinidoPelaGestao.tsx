'use client';

import React, { useState } from 'react';
import {
  Lock,
  Pencil,
  Clock3,
  XCircle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  ModalSolicitacaoGestao,
  SolicitacaoGestaoFormValues,
} from './ModalSolicitacaoGestao';

interface SolicitacaoGestaoData {
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
  servicosPrestados?: readonly string[];
  limitePacientesAtivos?: number;
  justificativa?: string;
  solicitadoEm: string;
  status: 'PENDENTE' | 'APROVADO' | 'RECUSADO';
  respondidoEm?: string;
  motivoRecusa?: string;
}

interface CardDefinidoPelaGestaoProps {
  cadastro: {
    turmaViverMais?: string;
    posGraduacaoViverMais?: string;
    segundaPosGraduacao?: string;
    servicosPrestados?: string[];
    limitePacientesAtivos?: number;
    pacientesAtivosCount?: number;
    solicitacaoAlteracaoGestao?: SolicitacaoGestaoData;
  };
  onSalvarSolicitacao: (valores: SolicitacaoGestaoFormValues) => Promise<void>;
  onCancelarSolicitacao: () => Promise<void>;
}

export function CardDefinidoPelaGestao({
  cadastro,
  onSalvarSolicitacao,
  onCancelarSolicitacao,
}: CardDefinidoPelaGestaoProps) {
  const [modalAberto, setModalAberto] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const pendente = cadastro.solicitacaoAlteracaoGestao?.status === 'PENDENTE';
  const solicitacao = cadastro.solicitacaoAlteracaoGestao;

  const handleCancelar = async () => {
    if (!confirm('Deseja cancelar sua solicitação de alteração pendente?')) return;
    setCancelando(true);
    try {
      await onCancelarSolicitacao();
    } finally {
      setCancelando(false);
    }
  };

  return (
    <>
      <section className="bg-surface rounded-3xl border border-line shadow-card p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-muted" />
            <div>
              <h2 className="font-black text-ink">Definido pela gestão</h2>
              <p className="text-[11px] text-muted">
                Critérios acadêmicos, capacidade e serviços homologados pela coordenação
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalAberto(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-psi-deep bg-psi-soft hover:bg-psi-soft/80 px-3.5 py-2 rounded-xl transition-all border border-psi-vibrant/20 shadow-xs"
          >
            <Pencil className="w-3.5 h-3.5 text-psi-vibrant" />
            <span>{pendente ? 'Editar solicitação' : 'Solicitar alteração à gestão'}</span>
          </button>
        </div>

        {/* Banner de Solicitação Pendente */}
        {pendente && solicitacao && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-4 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <Clock3 className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-extrabold text-amber-900">
                    Solicitação de alteração em análise pela coordenação
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Enviada em{' '}
                    {new Date(solicitacao.solicitadoEm).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={cancelando}
                onClick={handleCancelar}
                className="text-[11px] font-bold text-rose-700 hover:text-rose-900 hover:underline disabled:opacity-50"
              >
                {cancelando ? 'Cancelando…' : 'Cancelar pedido'}
              </button>
            </div>

            {/* Resumo do que foi solicitado */}
            <div className="bg-white/80 rounded-xl p-3 border border-amber-200/60 text-xs space-y-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                Itens solicitados:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-800">
                {solicitacao.turmaViverMais && (
                  <div>
                    <span className="text-muted font-medium">Turma: </span>
                    <strong className="font-bold">Turma {solicitacao.turmaViverMais}</strong>
                  </div>
                )}
                {solicitacao.posGraduacaoViverMais && (
                  <div>
                    <span className="text-muted font-medium">Pós-Graduação: </span>
                    <strong className="font-bold">{solicitacao.posGraduacaoViverMais}</strong>
                  </div>
                )}
                {solicitacao.segundaPosGraduacao && (
                  <div>
                    <span className="text-muted font-medium">2ª Pós: </span>
                    <strong className="font-bold">{solicitacao.segundaPosGraduacao}</strong>
                  </div>
                )}
                {solicitacao.limitePacientesAtivos !== undefined && (
                  <div>
                    <span className="text-muted font-medium">Capacidade: </span>
                    <strong className="font-bold">{solicitacao.limitePacientesAtivos} pacientes</strong>
                  </div>
                )}
              </div>

              {Boolean(solicitacao.servicosPrestados?.length) && (
                <div className="pt-1">
                  <span className="text-muted font-medium">Serviços solicitados: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {solicitacao.servicosPrestados?.map((s) => (
                      <span
                        key={s}
                        className="text-[10px] font-bold bg-amber-100/70 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {solicitacao.justificativa && (
                <div className="pt-1 text-[11px] text-slate-600 italic">
                  &ldquo;{solicitacao.justificativa}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        {/* Grid de Informações Homologadas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">
              Turma Viver Mais
            </p>
            <p className="text-sm font-bold text-ink mt-1">
              {cadastro.turmaViverMais ? `Turma ${cadastro.turmaViverMais}` : '—'}
            </p>
            <p className="text-[10px] text-muted mt-0.5">Registro acadêmico</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">
              Pós-graduação
            </p>
            <p className="text-sm font-bold text-ink mt-1">
              {cadastro.posGraduacaoViverMais || '—'}
            </p>
            <p className="text-[10px] text-muted mt-0.5">Registro acadêmico</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">
              Segunda pós-graduação
            </p>
            <p className="text-sm font-bold text-ink mt-1">
              {cadastro.segundaPosGraduacao || '—'}
            </p>
            <p className="text-[10px] text-muted mt-0.5">Registro acadêmico</p>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">
              Pacientes ativos
            </p>
            <p className="text-sm font-bold text-ink mt-1">
              {cadastro.pacientesAtivosCount ?? 0} de {cadastro.limitePacientesAtivos ?? 5}
            </p>
            <p className="text-[10px] text-muted mt-0.5">Capacidade definida pela clínica</p>
          </div>

          {/* Serviços Que Presto em Definido pela Gestão */}
          <div className="sm:col-span-2 pt-2 border-t border-line">
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-psi-vibrant" />
              <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">
                Serviços que presto (Homologados pela gestão)
              </p>
            </div>
            {cadastro.servicosPrestados?.length ? (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {cadastro.servicosPrestados.map((item) => (
                  <span
                    key={item}
                    className="text-[11px] font-bold bg-psi-soft text-psi-deep px-2.5 py-1 rounded-lg border border-psi-vibrant/20"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted mt-1">Nenhum serviço registrado</p>
            )}
            <p className="text-[10px] text-muted mt-1">
              Serviços clínicos ativos no rodízio de encaminhamentos da clínica
            </p>
          </div>
        </div>
      </section>

      {/* Modal de Solicitação */}
      {modalAberto && (
        <ModalSolicitacaoGestao
          dadosAtuais={{
            turmaViverMais: cadastro.turmaViverMais,
            posGraduacaoViverMais: cadastro.posGraduacaoViverMais,
            segundaPosGraduacao: cadastro.segundaPosGraduacao,
            servicosPrestados: cadastro.servicosPrestados,
            limitePacientesAtivos: cadastro.limitePacientesAtivos,
          }}
          solicitacaoPendente={
            pendente && solicitacao
              ? {
                  turmaViverMais: solicitacao.turmaViverMais,
                  posGraduacaoViverMais: solicitacao.posGraduacaoViverMais,
                  segundaPosGraduacao: solicitacao.segundaPosGraduacao,
                  servicosPrestados: solicitacao.servicosPrestados ? [...solicitacao.servicosPrestados] : undefined,
                  limitePacientesAtivos: solicitacao.limitePacientesAtivos,
                  justificativa: solicitacao.justificativa,
                }
              : undefined
          }
          onEnviar={async (valores) => {
            await onSalvarSolicitacao(valores);
            setModalAberto(false);
          }}
          onCancelar={() => setModalAberto(false)}
        />
      )}
    </>
  );
}

import React from 'react';
import type { CamposCadastroPsicologoProps } from './cadastroPsicologoFormState';
import { NecessidadesSelector } from './necessidades';
import { TIPOS_ATENDIMENTO, MODALIDADES_ATENDIMENTO, TURNOS_PSICOLOGO } from './opcoesPsicologo';

export function CadastroPsicologoPreferencias({ formPsicologo, setFormPsicologo }: CamposCadastroPsicologoProps) {
  return <>
        {/* DEMANDAS PARA ATENDIMENTO */}
        <NecessidadesSelector
          prefix="psicologo"
          titulo="DEMANDAS PARA ATENDIMENTO"
          subtitulo="Selecione “Outros” para atender demandas variadas, sem uma especificação principal."
          especificar={formPsicologo.especificarNecessidades}
          onEspecificarChange={(especificar) => setFormPsicologo((prev) => ({ ...prev, especificarNecessidades: especificar }))}
          selecionados={formPsicologo.necessidadesAtendidas}
          onSelecionadosChange={(necessidadesAtendidas) => setFormPsicologo((prev) => ({ ...prev, necessidadesAtendidas }))}
        />

        {/* Tipo de Atendimento (Particular, Social ou Ambos) */}
        <div>
          <label className="font-bold text-slate-700 block mb-1.5">
            Tipo de Atendimento <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {TIPOS_ATENDIMENTO.map((opcao) => (
              <label
                key={opcao.value}
                className={`flex items-center gap-2 cursor-pointer p-3 rounded-xl border text-xs font-bold transition-all ${
                  formPsicologo.atendimentoPreferencia === opcao.value
                    ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="atendimentoPreferencia"
                  value={opcao.value}
                  checked={formPsicologo.atendimentoPreferencia === opcao.value}
                  onChange={() =>
                    setFormPsicologo((prev) => ({
                      ...prev,
                      atendimentoPreferencia: opcao.value as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
                    }))
                  }
                  className="accent-purple-600"
                />
                <span>{opcao.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">Modalidade de Interesse <span className="text-rose-500">*</span></label>
          <div className="flex items-center gap-4 pt-1">
            {MODALIDADES_ATENDIMENTO.map((modalidade) => (
              <label key={modalidade.value} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="modalidadeAtendimento"
                  value={modalidade.value}
                  checked={formPsicologo.modalidadeAtendimento === modalidade.value}
                  onChange={() => setFormPsicologo({ ...formPsicologo, modalidadeAtendimento: modalidade.value })}
                  className="accent-purple-600"
                />
                {modalidade.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1.5">
            Turnos em que você atende <span className="text-rose-500">*</span>
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            O encaminhamento de pacientes cruza o turno pedido com o seu. Marque todos em que
            tem disponibilidade.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {TURNOS_PSICOLOGO.map((turno) => {
              const marcado = formPsicologo.disponibilidadeTurnos.includes(turno.value);
              return (
                <label
                  key={turno.value}
                  className={`flex items-center gap-2 cursor-pointer p-3 rounded-xl border text-xs font-bold transition-all ${
                    marcado
                      ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    onChange={() =>
                      setFormPsicologo((prev) => ({
                        ...prev,
                        disponibilidadeTurnos: marcado
                          ? prev.disponibilidadeTurnos.filter((t) => t !== turno.value)
                          : [...prev.disponibilidadeTurnos, turno.value],
                      }))
                    }
                    className="accent-purple-600"
                  />
                  <span>{turno.label}</span>
                </label>
              );
            })}
          </div>
        </div>

  </>;
}

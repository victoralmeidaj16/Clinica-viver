import React from 'react';
import type { CamposCadastroPsicologoProps } from './cadastroPsicologoFormState';
import { maskCrpInput } from '@/lib/crp';
import { TemposAtendimentoPsicologo } from './TemposAtendimentoPsicologo';
import { POS_GRADUACOES_VIVER_MAIS, SEGUNDAS_POS_GRADUACOES, TURMAS_VIVER_MAIS, opcoesAtendimentoDaPos } from './opcoesPsicologo';

interface Props extends CamposCadastroPsicologoProps {
  temSegundaPos: boolean;
  setTemSegundaPos: React.Dispatch<React.SetStateAction<boolean>>;
  segundaPosGraduacao: string;
  setSegundaPosGraduacao: React.Dispatch<React.SetStateAction<string>>;
}

export function CadastroPsicologoFormacao({ formPsicologo, setFormPsicologo, temSegundaPos, setTemSegundaPos, segundaPosGraduacao, setSegundaPosGraduacao }: Props) {
  return <>
        {/* Pós-Graduação Principal Viver Mais */}
        <div>
          <label className="font-bold text-slate-700 block mb-1">Pós-Graduação na Viver Mais Psicologia <span className="text-rose-500">*</span></label>
          <select
            value={formPsicologo.posGraduacaoViverMais}
            onChange={(e) => setFormPsicologo({ ...formPsicologo, posGraduacaoViverMais: e.target.value })}
            className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 font-medium"
          >
            {POS_GRADUACOES_VIVER_MAIS.map((pos) => (
              <option key={pos} value={pos}>{pos}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Turma Viver Mais <span className="text-rose-500">*</span></label>
            <select
              value={formPsicologo.turmaViverMais}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, turmaViverMais: e.target.value })}
              className="w-full border border-slate-300 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 font-bold"
            >
              {TURMAS_VIVER_MAIS.map((turma) => (
                <option key={turma} value={turma}>Turma {turma}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Registro CRP <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={formPsicologo.crp}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, crp: maskCrpInput(e.target.value) })}
              placeholder="Ex: 12/34567"
              maxLength={10}
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        {/* Segunda Pós-Graduação Viver Mais */}
        <div>
          {/* Checkbox para Segunda Pós-Graduação */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={temSegundaPos}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setTemSegundaPos(checked);
                  if (!checked) {
                    setSegundaPosGraduacao('');
                  } else if (!segundaPosGraduacao) {
                    setSegundaPosGraduacao(POS_GRADUACOES_VIVER_MAIS[0]);
                  }
                }}
                className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
              />
              <span>Possui 2ª Pós-Graduação?</span>
            </label>
          </div>
        </div>

        {/* Campo para Selecionar a Segunda Pós-Graduação */}
        {temSegundaPos && (
          <div className="animate-in fade-in duration-200 bg-purple-50/60 p-4 rounded-2xl border border-purple-100 space-y-2">
            <label className="font-bold text-purple-900 block mb-1">
              Selecione a Segunda Pós-Graduação <span className="text-rose-500">*</span>
            </label>
            <select
              value={segundaPosGraduacao}
              onChange={(e) => setSegundaPosGraduacao(e.target.value)}
              className="w-full border border-purple-200 bg-white rounded-xl p-3 focus:outline-none focus:border-purple-600 font-medium text-slate-800"
            >
              {SEGUNDAS_POS_GRADUACOES.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>
          </div>
        )}

        {(() => {
          const opcoesAtendimento = opcoesAtendimentoDaPos(
            formPsicologo.posGraduacaoViverMais,
            temSegundaPos ? segundaPosGraduacao : undefined
          );
          if (!opcoesAtendimento) return null;
          return <>
        <div className="space-y-2">
          <label className="font-bold text-slate-700 block">
            MODALIDADE DE ATENDIMENTO <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {opcoesAtendimento.servicos.map((servico) => {
              const checked = formPsicologo.servicosPrestados.includes(servico);
              return (
                <label
                  key={servico}
                  className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border transition-all ${
                    checked
                      ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const newServicos = checked
                        ? formPsicologo.servicosPrestados.filter((s) => s !== servico)
                        : [...formPsicologo.servicosPrestados, servico];
                      setFormPsicologo({ ...formPsicologo, servicosPrestados: newServicos });
                    }}
                    className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                  />
                  <span>{servico}</span>
                </label>
              );
            })}
          </div>
        </div>

        <TemposAtendimentoPsicologo posGraduacao={formPsicologo.posGraduacaoViverMais}
          segundaPosGraduacao={temSegundaPos ? segundaPosGraduacao : undefined} value={formPsicologo.temposAtendimento}
          onChange={(temposAtendimento) => setFormPsicologo((current) => ({ ...current, temposAtendimento }))} />

        <div className="space-y-2">
          <label className="font-bold text-slate-700 block">
            PÚBLICO ALVO <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {opcoesAtendimento.publico.map((publico) => {
              const checked = formPsicologo.publicoAlvo.includes(publico);
              return (
                <label
                  key={publico}
                  className={`flex items-center gap-2 cursor-pointer p-2.5 rounded-xl border transition-all ${
                    checked
                      ? 'bg-purple-50 border-purple-400 text-purple-950 font-bold shadow-xs'
                      : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const newPublico = checked
                        ? formPsicologo.publicoAlvo.filter((p) => p !== publico)
                        : [...formPsicologo.publicoAlvo, publico];
                      setFormPsicologo({ ...formPsicologo, publicoAlvo: newPublico });
                    }}
                    className="accent-purple-600 w-4 h-4 rounded cursor-pointer"
                  />
                  <span>{publico}</span>
                </label>
              );
            })}
          </div>

          {formPsicologo.publicoAlvo.includes('Outro') && (
            <div className="animate-in fade-in duration-200 pt-1">
              <input
                type="text"
                value={formPsicologo.publicoAlvoOutro}
                onChange={(e) => setFormPsicologo({ ...formPsicologo, publicoAlvoOutro: e.target.value })}
                placeholder="Especifique o público alvo (ex: Gestantes, Atletas...)"
                className="w-full border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:border-purple-600"
              />
            </div>
          )}
        </div>
          </>;
        })()}

  </>;
}

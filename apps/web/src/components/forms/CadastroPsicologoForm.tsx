'use client';

import React, { useState } from 'react';
import { UserPlus, Upload } from 'lucide-react';
import { BrazilLocationFields } from '@/components/forms/BrazilLocationFields';
import { GenderFields } from '@/components/forms/GenderFields';
import { NecessidadesSelector } from '@/components/forms/necessidades';
import {
  MODALIDADES_ATENDIMENTO,
  POS_GRADUACOES_VIVER_MAIS,
  PUBLICO_ALVO,
  SEGUNDAS_POS_GRADUACOES,
  SERVICOS_PRESTADOS,
  TIPOS_ATENDIMENTO,
  TURMAS_VIVER_MAIS,
  TURNOS_PSICOLOGO,
} from '@/components/forms/opcoesPsicologo';
import { processImageUpload } from '@/lib/imageUpload';
import { maskBrazilPhoneInput, normalizeBrazilPhone } from '@/lib/brazilPhone';
import { validateGender, type GenderValue } from '@/lib/gender';

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
  const [temNomeSocialPsicologo, setTemNomeSocialPsicologo] = useState(false);
  const [temSegundaPos, setTemSegundaPos] = useState(false);
  const [segundaPosGraduacao, setSegundaPosGraduacao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formPsicologo, setFormPsicologo] = useState({
    nomeCompleto: '',
    nomeSocial: '',
    crp: '',
    whatsapp: '',
    email: '',
    fotoUrl: '',
    modalidadeAtendimento: 'AMBOS',
    atendimentoPreferencia: 'AMBOS' as 'PARTICULAR' | 'SOCIAL' | 'AMBOS',
    estadoUf: '',
    cidade: '',
    logradouro: '',
    bairro: '',
    genero: '' as GenderValue | '',
    generoOutro: '',
    turmaViverMais: '22A',
    posGraduacaoViverMais: POS_GRADUACOES_VIVER_MAIS[0],
    servicosPrestados: ['Atendimento Psicológico'] as string[],
    publicoAlvo: ['Homens'] as string[],
    publicoAlvoOutro: '',
    especificarNecessidades: false,
    necessidadesAtendidas: [] as string[],
    necessidadesOutro: '',
    especialidade: '',
    minibio: '',
    disponibilidadeTurnos: [] as string[],
  });

  const handleSubmitPsicologo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizeBrazilPhone(formPsicologo.whatsapp)) {
      alert('Informe um telefone brasileiro válido com DDD.');
      return;
    }
    if (!formPsicologo.estadoUf || !formPsicologo.cidade) {
      alert('Selecione o estado e uma cidade da lista.');
      return;
    }
    if (!formPsicologo.logradouro.trim() || !formPsicologo.bairro.trim()) {
      alert('Informe rua/logradouro e bairro.');
      return;
    }
    if (!validateGender(formPsicologo.genero, formPsicologo.generoOutro)) {
      alert('Selecione o gênero e, se escolher Outro, informe a descrição.');
      return;
    }
    if (formPsicologo.servicosPrestados.length === 0) {
      alert('Selecione ao menos um serviço prestado.');
      return;
    }
    if (formPsicologo.publicoAlvo.length === 0) {
      alert('Selecione ao menos um público alvo.');
      return;
    }
    if (formPsicologo.disponibilidadeTurnos.length === 0) {
      alert('Selecione ao menos um turno de atendimento.');
      return;
    }
    setIsSubmitting(true);
    try {
      const resp = await fetch('/api/application/credenciamento-psicologo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formPsicologo,
          segundaPosGraduacao: temSegundaPos ? segundaPosGraduacao : undefined,
        }),
      });
      const data = (await resp.json()) as { success: boolean; error?: string; data?: CadastroPsicologoCriado };
      if (data.success) {
        await onSucesso(data.data ?? ({ id: '' } as CadastroPsicologoCriado));
      } else {
        alert(data.error ?? 'Erro ao cadastrar psicólogo. Tente novamente.');
      }
    } catch (err) {
      console.error(err);
      alert('Erro de conexão ao enviar credenciamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

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

      <form onSubmit={handleSubmitPsicologo} className="space-y-4 text-xs">
        <div className="space-y-3">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Nome Completo <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={formPsicologo.nomeCompleto}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, nomeCompleto: e.target.value })}
              placeholder="Seu nome completo"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
            <div className="mt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={temNomeSocialPsicologo}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setTemNomeSocialPsicologo(checked);
                    if (!checked) {
                      setFormPsicologo((prev) => ({ ...prev, nomeSocial: '' }));
                    }
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 accent-purple-600 cursor-pointer"
                />
                <span>Possui Nome Social?</span>
              </label>
            </div>
          </div>

          {temNomeSocialPsicologo && (
            <div className="animate-in fade-in duration-200">
              <label className="font-bold text-slate-700 block mb-1">
                Nome Social <span className="text-slate-400 font-normal">(como prefere ser chamado)</span>
              </label>
              <input
                type="text"
                value={formPsicologo.nomeSocial}
                onChange={(e) => setFormPsicologo({ ...formPsicologo, nomeSocial: e.target.value })}
                placeholder="Digite seu nome social"
                className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
              />
            </div>
          )}
        </div>

        <div>
          <label className="font-bold text-slate-700 block mb-1">
            Foto de Perfil <span className="text-slate-400 font-normal">(opcional)</span>
          </label>
          {formPsicologo.fotoUrl ? (
            <div className="flex items-center gap-4 p-3 border border-purple-200 bg-purple-50/50 rounded-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={formPsicologo.fotoUrl}
                alt="Foto de Perfil"
                className="w-16 h-16 rounded-full object-cover border-2 border-purple-500 shadow-sm"
              />
              <div className="flex flex-col gap-1">
                <span className="text-xs font-bold text-purple-900">Foto carregada com sucesso</span>
                <button
                  type="button"
                  onClick={() => setFormPsicologo({ ...formPsicologo, fotoUrl: '' })}
                  className="text-xs text-rose-600 hover:text-rose-800 font-extrabold text-left underline"
                >
                  Remover / Trocar foto
                </button>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-purple-200 hover:border-purple-500 bg-purple-50/30 hover:bg-purple-50/70 p-4 rounded-2xl cursor-pointer transition-all">
              <Upload className="w-6 h-6 text-purple-600 mb-1" />
              <span className="text-xs font-bold text-purple-900">Clique para enviar uma foto de perfil</span>
              <span className="text-[10px] text-slate-500">Envie um arquivo de imagem (PNG, JPG, WEBP)</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    try {
                      const compressedDataUrl = await processImageUpload(file);
                      setFormPsicologo((prev) => ({ ...prev, fotoUrl: compressedDataUrl }));
                    } catch (err) {
                      console.error('Erro ao processar imagem:', err);
                      alert('Não foi possível processar a imagem selecionada. Tente outro formato.');
                    }
                  }
                }}
              />
            </label>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Registro CRP <span className="text-rose-500">*</span></label>
            <input
              type="text"
              required
              value={formPsicologo.crp}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, crp: e.target.value })}
              placeholder="Ex: CRP 07/12345"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
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
        </div>

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

          {/* Checkbox para Segunda Pós-Graduação */}
          <div className="mt-3">
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

        {/* SERVIÇO PRESTADO */}
        <div className="space-y-2">
          <label className="font-bold text-slate-700 block">
            SERVIÇO PRESTADO <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {SERVICOS_PRESTADOS.map((servico) => {
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

        {/* PÚBLICO ALVO */}
        <div className="space-y-2">
          <label className="font-bold text-slate-700 block">
            PÚBLICO ALVO <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            {PUBLICO_ALVO.map((publico) => {
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

        {/* DEMANDAS PARA ATENDIMENTO */}
        <NecessidadesSelector
          prefix="psicologo"
          titulo="DEMANDAS PARA ATENDIMENTO"
          subtitulo={null}
          especificar={formPsicologo.especificarNecessidades}
          onEspecificarChange={(especificar) => setFormPsicologo((prev) => ({ ...prev, especificarNecessidades: especificar }))}
          selecionados={formPsicologo.necessidadesAtendidas}
          onSelecionadosChange={(necessidadesAtendidas) => setFormPsicologo((prev) => ({ ...prev, necessidadesAtendidas }))}
          outro={formPsicologo.necessidadesOutro}
          onOutroChange={(necessidadesOutro) => setFormPsicologo((prev) => ({ ...prev, necessidadesOutro }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">E-mail Profissional <span className="text-rose-500">*</span></label>
            <input
              type="email"
              required
              value={formPsicologo.email}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, email: e.target.value })}
              placeholder="seuemail@exemplo.com"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">Telefone / WhatsApp Profissional <span className="text-rose-500">*</span></label>
            <input
              type="tel"
              required
              value={formPsicologo.whatsapp}
              onChange={(e) => setFormPsicologo({ ...formPsicologo, whatsapp: maskBrazilPhoneInput(e.target.value) })}
              placeholder="(48) 99999-9999"
              inputMode="tel"
              autoComplete="tel"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

        <GenderFields
          idPrefix="psicologo"
          gender={formPsicologo.genero}
          other={formPsicologo.generoOutro}
          onGenderChange={(genero) => setFormPsicologo((current) => ({ ...current, genero }))}
          onOtherChange={(generoOutro) => setFormPsicologo((current) => ({ ...current, generoOutro }))}
        />

        <BrazilLocationFields
          estadoUf={formPsicologo.estadoUf}
          cidade={formPsicologo.cidade}
          onEstadoChange={(estadoUf) => setFormPsicologo((current) => ({ ...current, estadoUf, cidade: '' }))}
          onCidadeChange={(cidade) => setFormPsicologo((current) => ({ ...current, cidade }))}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Rua / logradouro <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formPsicologo.logradouro}
              onChange={(e) => setFormPsicologo((current) => ({ ...current, logradouro: e.target.value }))}
              autoComplete="street-address"
              placeholder="Ex.: Rua das Flores, 123"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              Bairro <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formPsicologo.bairro}
              onChange={(e) => setFormPsicologo((current) => ({ ...current, bairro: e.target.value }))}
              autoComplete="address-level3"
              placeholder="Ex.: Centro"
              className="w-full border border-slate-300 rounded-xl p-3 focus:outline-none focus:border-purple-600"
            />
          </div>
        </div>

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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-purple-700 hover:bg-purple-800 disabled:opacity-60 disabled:cursor-not-allowed text-white font-extrabold py-3.5 rounded-2xl shadow-lg shadow-purple-700/25 transition-all text-xs flex items-center justify-center gap-1.5 mt-2"
        >
          <UserPlus className="w-4 h-4" />
          {isSubmitting ? 'ENVIANDO…' : labelEnviar}
        </button>
      </form>
    </div>
  );
}

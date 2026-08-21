'use client';

import React, { useState } from 'react';
import {
  User,
  MapPin,
  GraduationCap,
  Briefcase,
  SlidersHorizontal,
  Save,
  X,
  AlertCircle,
  Camera,
  Upload,
} from 'lucide-react';
import { LISTA_NECESSIDADES } from '@/components/forms/necessidades';
import {
  PUBLICO_ALVO,
  TIPOS_ATENDIMENTO,
  SERVICOS_PRESTADOS,
  TURNOS_PSICOLOGO,
  TURMAS_VIVER_MAIS,
  POS_GRADUACOES_VIVER_MAIS,
  MODALIDADES_ATENDIMENTO,
  comValoresRegistrados,
} from '@/components/forms/opcoesPsicologo';
import { GenderFields } from '@/components/forms/GenderFields';
import { BrazilLocationFields } from '@/components/forms/BrazilLocationFields';
import { maskBrazilPhoneInput, normalizeBrazilPhone } from '@/lib/brazilPhone';
import type { GenderValue } from '@/lib/gender';
import type { PsicologoItem } from './types';

type AbaEdicao = 'dados' | 'endereco' | 'formacao' | 'criterios';

export function ModalEdicao({
  psicologo,
  onSalvar,
  onCancelar,
}: {
  psicologo: PsicologoItem;
  onSalvar: (mudancas: Record<string, unknown>) => void | Promise<void>;
  onCancelar: () => void;
}) {
  const [abaAtiva, setAbaAtiva] = useState<AbaEdicao>('dados');

  // 1. Dados Pessoais & Contato
  const [nomeCompleto, setNomeCompleto] = useState(psicologo.nomeCompleto ?? '');
  const [nomeSocial, setNomeSocial] = useState(psicologo.nomeSocial ?? '');
  const [crp, setCrp] = useState(psicologo.crp ?? '');
  const [whatsapp, setWhatsapp] = useState(maskBrazilPhoneInput(psicologo.whatsapp ?? ''));
  const [email, setEmail] = useState(psicologo.email ?? '');
  const [fotoUrl, setFotoUrl] = useState(psicologo.fotoUrl ?? '');
  const [genero, setGenero] = useState<GenderValue | ''>((psicologo.genero as GenderValue) ?? '');
  const [generoOutro, setGeneroOutro] = useState(psicologo.generoOutro ?? '');

  // 2. Endereço & Localização
  const [estadoUf, setEstadoUf] = useState(psicologo.estadoUf ?? '');
  const [cidade, setCidade] = useState(psicologo.cidade ?? '');
  const [logradouro, setLogradouro] = useState(psicologo.logradouro ?? '');
  const [bairro, setBairro] = useState(psicologo.bairro ?? '');

  // 3. Formação & Atuação
  const [turmaViverMais, setTurmaViverMais] = useState(psicologo.turmaViverMais ?? '');
  const [posGraduacaoViverMais, setPosGraduacaoViverMais] = useState(psicologo.posGraduacaoViverMais ?? '');
  const [segundaPosGraduacao, setSegundaPosGraduacao] = useState(psicologo.segundaPosGraduacao ?? '');
  const [especialidade, setEspecialidade] = useState(psicologo.especialidade ?? '');
  const [modalidadeAtendimento, setModalidadeAtendimento] = useState(psicologo.modalidadeAtendimento ?? 'ONLINE');
  const [limitePacientesAtivos, setLimitePacientesAtivos] = useState(psicologo.limitePacientesAtivos ?? 5);
  const [minibio, setMinibio] = useState(psicologo.minibio ?? '');

  // 4. Critérios de Rodízio & Encaminhamento
  const [turnos, setTurnos] = useState<string[]>([...(psicologo.turnosDisponiveis ?? [])]);
  const [servicos, setServicos] = useState<string[]>([...(psicologo.servicosPrestados ?? [])]);
  const [publicos, setPublicos] = useState<string[]>([...(psicologo.publicoAlvo ?? [])]);
  const [publicoOutro, setPublicoOutro] = useState(psicologo.publicoAlvoOutro ?? '');
  const [especificarNecessidades, setEspecificarNecessidades] = useState<boolean>(
    Boolean(psicologo.especificarNecessidades || psicologo.necessidadesAtendidas?.length || psicologo.necessidadesOutro)
  );
  const [necessidades, setNecessidades] = useState<string[]>([...(psicologo.necessidadesAtendidas ?? [])]);
  const [necessidadeOutra, setNecessidadeOutra] = useState(psicologo.necessidadesOutro ?? '');
  const [preferencia, setPreferencia] = useState<'PARTICULAR' | 'SOCIAL' | 'AMBOS'>(
    psicologo.atendimentoPreferencia ?? 'AMBOS'
  );

  const [aviso, setAviso] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const alternar = (lista: string[], valor: string) =>
    lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];

  const chip = (marcado: boolean) =>
    `cursor-pointer px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
      marcado
        ? 'bg-purple-600 border-purple-600 text-white shadow-xs'
        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
    }`;

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white p-3 text-xs font-medium text-slate-800 outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-100 transition-all';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAviso(null);

    if (!nomeCompleto.trim()) {
      setAbaAtiva('dados');
      setAviso('O Nome Completo é obrigatório.');
      return;
    }

    if (!crp.trim()) {
      setAbaAtiva('dados');
      setAviso('O CRP é obrigatório.');
      return;
    }

    const whatsappLimpo = normalizeBrazilPhone(whatsapp);
    if (!whatsappLimpo) {
      setAbaAtiva('dados');
      setAviso('Informe um Telefone / WhatsApp válido com DDD.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setAbaAtiva('dados');
      setAviso('Informe um E-mail profissional válido.');
      return;
    }

    if (turnos.length === 0) {
      setAbaAtiva('criterios');
      setAviso('Selecione ao menos um turno para encaminhamento de pacientes.');
      return;
    }

    const limiteNum = Number(limitePacientesAtivos);
    if (!Number.isInteger(limiteNum) || limiteNum < 1 || limiteNum > 5) {
      setAbaAtiva('formacao');
      setAviso('O limite de pacientes ativos deve ser um número entre 1 e 5.');
      return;
    }

    setSalvando(true);
    try {
      await onSalvar({
        // Dados Pessoais & Contato
        nomeCompleto: nomeCompleto.trim(),
        nomeSocial: nomeSocial.trim() || undefined,
        crp: crp.trim(),
        whatsapp: whatsappLimpo,
        email: email.trim().toLowerCase(),
        fotoUrl: fotoUrl.trim() || undefined,
        genero: genero || undefined,
        generoOutro: genero === 'OUTRO' ? generoOutro.trim() : undefined,

        // Endereço
        estadoUf: estadoUf.trim().toUpperCase() || undefined,
        cidade: cidade.trim() || undefined,
        logradouro: logradouro.trim() || undefined,
        bairro: bairro.trim() || undefined,

        // Formação & Atuação
        turmaViverMais: turmaViverMais.trim() || undefined,
        posGraduacaoViverMais: posGraduacaoViverMais.trim() || undefined,
        segundaPosGraduacao: segundaPosGraduacao.trim() || undefined,
        especialidade: especialidade.trim() || undefined,
        modalidadeAtendimento: modalidadeAtendimento.trim() || undefined,
        limitePacientesAtivos: limiteNum,
        minibio: minibio.trim() || undefined,

        // Critérios & Rodízio
        turnosDisponiveis: turnos,
        servicosPrestados: servicos,
        publicoAlvo: publicos,
        publicoAlvoOutro: publicoOutro.trim() || undefined,
        especificarNecessidades: especificarNecessidades && (necessidades.length > 0 || Boolean(necessidadeOutra.trim())),
        necessidadesAtendidas: especificarNecessidades ? necessidades : [],
        necessidadesOutro: especificarNecessidades ? necessidadeOutra.trim() || undefined : undefined,
        atendimentoPreferencia: preferencia,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-900 px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-400/30">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold sm:text-lg">
                Editar Cadastro do Psicólogo
              </h2>
              <p className="text-xs text-slate-400">
                {psicologo.nomeSocial?.trim() || psicologo.nomeCompleto} • CRP {psicologo.crp}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancelar}
            disabled={salvando}
            aria-label="Fechar"
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs de Navegação */}
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 overflow-x-auto">
          {[
            { id: 'dados', label: '1. Identificação & Contato', icon: User },
            { id: 'endereco', label: '2. Localização', icon: MapPin },
            { id: 'formacao', label: '3. Formação & Perfil', icon: GraduationCap },
            { id: 'criterios', label: '4. Critérios & Rodízio', icon: SlidersHorizontal },
          ].map((tab) => {
            const Icon = tab.icon;
            const ativa = abaAtiva === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setAbaAtiva(tab.id as AbaEdicao);
                  setAviso(null);
                }}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-xs font-extrabold whitespace-nowrap transition-all ${
                  ativa
                    ? 'border-purple-600 text-purple-900 bg-white shadow-xs'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                }`}
              >
                <Icon className={`h-4 w-4 ${ativa ? 'text-purple-600' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mensagem de Alerta / Validação */}
        {aviso && (
          <div className="mx-6 mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800 animate-in fade-in">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{aviso}</span>
          </div>
        )}

        {/* Formulário com Abas */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* ABA 1: Identificação & Contato */}
          {abaAtiva === 'dados' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Nome Completo <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={nomeCompleto}
                    onChange={(e) => setNomeCompleto(e.target.value)}
                    placeholder="Nome completo do psicólogo"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Nome Social <span className="text-slate-400 font-normal">(como prefere ser chamado)</span>
                  </label>
                  <input
                    type="text"
                    value={nomeSocial}
                    onChange={(e) => setNomeSocial(e.target.value)}
                    placeholder="Ex: Dra. Ana..."
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    CRP <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    value={crp}
                    onChange={(e) => setCrp(e.target.value)}
                    placeholder="Ex: 06/123456"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Telefone / WhatsApp Profissional <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(maskBrazilPhoneInput(e.target.value))}
                    placeholder="(11) 99999-8888"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    E-mail Profissional <span className="text-rose-500">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="psicologo@email.com"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Foto de Perfil <span className="text-slate-400 font-normal">(opcional)</span>
                </label>
                {fotoUrl ? (
                  <div className="flex items-center gap-4 p-3 border border-purple-200 bg-purple-50/50 rounded-2xl">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={fotoUrl}
                      alt="Foto de Perfil"
                      className="w-16 h-16 rounded-full object-cover border-2 border-purple-500 shadow-sm"
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-purple-900">Foto carregada com sucesso</span>
                      <button
                        type="button"
                        onClick={() => setFotoUrl('')}
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
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            if (event.target?.result) {
                              setFotoUrl(String(event.target?.result));
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                )}
              </div>

              <GenderFields
                idPrefix="modal-psi-edicao"
                gender={genero}
                other={generoOutro}
                onGenderChange={(g) => setGenero(g)}
                onOtherChange={(out) => setGeneroOutro(out)}
              />
            </div>
          )}

          {/* ABA 2: Localização */}
          {abaAtiva === 'endereco' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <BrazilLocationFields
                estadoUf={estadoUf}
                cidade={cidade}
                onEstadoChange={(uf) => {
                  setEstadoUf(uf);
                  setCidade('');
                }}
                onCidadeChange={(cid) => setCidade(cid)}
                required={false}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Rua / Logradouro
                  </label>
                  <input
                    type="text"
                    value={logradouro}
                    onChange={(e) => setLogradouro(e.target.value)}
                    placeholder="Ex: Av. Paulista, 1000"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Bairro
                  </label>
                  <input
                    type="text"
                    value={bairro}
                    onChange={(e) => setBairro(e.target.value)}
                    placeholder="Ex: Bela Vista"
                    className={inputClass}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: Formação & Perfil */}
          {abaAtiva === 'formacao' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Turma Viver Mais
                  </label>
                  <select
                    value={turmaViverMais}
                    onChange={(e) => setTurmaViverMais(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione a turma...</option>
                    {TURMAS_VIVER_MAIS.map((t) => (
                      <option key={t} value={t}>
                        Turma {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Pós-graduação Viver Mais
                  </label>
                  <select
                    value={posGraduacaoViverMais}
                    onChange={(e) => setPosGraduacaoViverMais(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Selecione a pós-graduação...</option>
                    {POS_GRADUACOES_VIVER_MAIS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Segunda Pós-graduação <span className="text-slate-400 font-normal">(opcional)</span>
                  </label>
                  <select
                    value={segundaPosGraduacao}
                    onChange={(e) => setSegundaPosGraduacao(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Nenhuma / Não possui</option>
                    {POS_GRADUACOES_VIVER_MAIS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Especialidade / Abordagem Principal
                  </label>
                  <input
                    type="text"
                    value={especialidade}
                    onChange={(e) => setEspecialidade(e.target.value)}
                    placeholder="Ex: TCC, Psicanálise, Neuropsicologia..."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1 text-xs">
                    Modalidade de Atendimento
                  </label>
                  <select
                    value={modalidadeAtendimento}
                    onChange={(e) => setModalidadeAtendimento(e.target.value)}
                    className={inputClass}
                  >
                    {MODALIDADES_ATENDIMENTO.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Limite de Pacientes Ativos (1 a 5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={limitePacientesAtivos}
                  onChange={(e) => setLimitePacientesAtivos(Number(e.target.value))}
                  className={inputClass}
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Define o teto de pacientes simultâneos que o psicólogo pode receber da clínica.
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1 text-xs">
                  Minibio / Apresentação Profissional
                </label>
                <textarea
                  rows={4}
                  value={minibio}
                  onChange={(e) => setMinibio(e.target.value)}
                  placeholder="Apresentação do psicólogo exibida no perfil..."
                  className={inputClass}
                />
              </div>
            </div>
          )}

          {/* ABA 4: Critérios & Rodízio */}
          {abaAtiva === 'criterios' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              <div>
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
                  Turnos em que atende <span className="text-rose-500">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {TURNOS_PSICOLOGO.map((turno) => (
                    <label key={turno.value} className={chip(turnos.includes(turno.value))}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={turnos.includes(turno.value)}
                        onChange={() => setTurnos(alternar(turnos, turno.value))}
                      />
                      {turno.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
                  Serviços Prestados
                </label>
                <div className="flex flex-wrap gap-2">
                  {comValoresRegistrados(SERVICOS_PRESTADOS, servicos).map((servico) => (
                    <label key={servico} className={chip(servicos.includes(servico))}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={servicos.includes(servico)}
                        onChange={() => setServicos(alternar(servicos, servico))}
                      />
                      {servico}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
                  Público que Atende
                </label>
                <div className="flex flex-wrap gap-2">
                  {comValoresRegistrados(PUBLICO_ALVO, publicos).map((publico) => (
                    <label key={publico} className={chip(publicos.includes(publico))}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={publicos.includes(publico)}
                        onChange={() => setPublicos(alternar(publicos, publico))}
                      />
                      {publico}
                    </label>
                  ))}
                </div>
                {publicos.includes('Outro') && (
                  <input
                    value={publicoOutro}
                    onChange={(e) => setPublicoOutro(e.target.value)}
                    placeholder="Outro público atendido..."
                    className="mt-2.5 w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-800 outline-none focus:border-purple-600"
                  />
                )}
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                <div>
                  <label className="font-bold text-slate-800 text-xs sm:text-sm block">
                    DEMANDAS PARA ATENDIMENTO
                  </label>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    Especificar demandas clínicas que o profissional atende com prioridade no rodízio.
                  </span>
                </div>

                <div className="flex items-center gap-6 text-xs font-bold">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edicao-especificar-necessidades"
                      checked={especificarNecessidades === true}
                      onChange={() => setEspecificarNecessidades(true)}
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                    />
                    <span>SIM</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="edicao-especificar-necessidades"
                      checked={especificarNecessidades === false}
                      onChange={() => {
                        setEspecificarNecessidades(false);
                        setNecessidades([]);
                        setNecessidadeOutra('');
                      }}
                      className="w-4 h-4 accent-purple-600 cursor-pointer"
                    />
                    <span>NÃO</span>
                  </label>
                </div>

                {especificarNecessidades && (
                  <div className="pt-3 border-t border-slate-200 space-y-3 animate-in fade-in duration-200">
                    <div className="flex flex-wrap gap-1.5 max-h-56 overflow-y-auto p-1">
                      {LISTA_NECESSIDADES.map((necessidade) => (
                        <label key={necessidade} className={chip(necessidades.includes(necessidade))}>
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={necessidades.includes(necessidade)}
                            onChange={() => setNecessidades(alternar(necessidades, necessidade))}
                          />
                          {necessidade}
                        </label>
                      ))}
                    </div>
                    <input
                      value={necessidadeOutra}
                      onChange={(e) => setNecessidadeOutra(e.target.value)}
                      placeholder="Outra demanda específica declarada..."
                      className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs text-slate-800 outline-none focus:border-purple-600"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block mb-2">
                  Tipo de Atendimento / Preferência
                </label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_ATENDIMENTO.map((tipo) => (
                    <label key={tipo.value} className={chip(preferencia === tipo.value)}>
                      <input
                        type="radio"
                        className="sr-only"
                        checked={preferencia === tipo.value}
                        onChange={() => setPreferencia(tipo.value as 'PARTICULAR' | 'SOCIAL' | 'AMBOS')}
                      />
                      {tipo.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer de Ações */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancelar}
              disabled={salvando}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={salvando}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-purple-600 text-white font-extrabold text-xs shadow-lg shadow-purple-600/20 hover:bg-purple-700 active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{salvando ? 'Salvando alterações…' : 'Salvar Todas as Alterações'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

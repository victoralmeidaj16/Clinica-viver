'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock3,
  FileText,
  Info,
  Lock,
  Mail,
  Pencil,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { formatBrazilPhone, maskBrazilPhoneInput, normalizeBrazilPhone } from '@/lib/brazilPhone';
import { formatGender } from '@/lib/gender';
import { LISTA_NECESSIDADES } from '@/app/vitrine/page';
import { BrazilLocationFields } from '@/components/forms/BrazilLocationFields';

interface Cadastro {
  id: string;
  nomeCompleto: string;
  nomeSocial?: string;
  crp: string;
  whatsapp: string;
  email?: string;
  fotoUrl?: string;
  estadoUf?: string;
  cidade?: string;
  logradouro?: string;
  bairro?: string;
  cidadeUf?: string;
  genero?: string;
  generoOutro?: string;
  especialidade?: string;
  modalidadeAtendimento?: string;
  atendimentoPreferencia?: 'PARTICULAR' | 'SOCIAL' | 'AMBOS';
  minibio?: string;
  status: 'EM_ANALISE' | 'APROVADO' | 'RECUSADO';
  turnosDisponiveis?: string[];
  modalidadesAtendidas?: string[];
  servicosHabilitados?: string[];
  servicosPrestados?: string[];
  publicoAlvo?: string[];
  publicoAlvoOutro?: string;
  especificarNecessidades?: boolean;
  necessidadesAtendidas?: string[];
  necessidadesOutro?: string;
  limitePacientesAtivos?: number;
  pacientesAtivosCount?: number;
  exibirNaVitrine?: boolean;
  motivoDesativacao?: string;
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
  criadoEm?: string;
}

const statusInfo = {
  EM_ANALISE: { label: 'Em análise pela gestão', description: 'A gestão recebeu seu cadastro e está conferindo as informações profissionais.', icon: Clock3, color: 'amber' },
  APROVADO: { label: 'Aprovado e publicado', description: 'Seu perfil está disponível na vitrine e elegível para receber novos pacientes.', icon: CheckCircle2, color: 'emerald' },
  RECUSADO: { label: 'Cadastro recusado', description: 'A gestão solicitou que este cadastro seja revisado antes de uma nova análise.', icon: XCircle, color: 'rose' },
} as const;

const TURNOS = [
  { value: 'MANHA', label: 'Manhã' },
  { value: 'TARDE', label: 'Tarde' },
  { value: 'NOITE', label: 'Noite' },
];

const SERVICOS = [
  'Atendimento Psicológico',
  'Avaliação Psicológica',
  'Orientação Vocacional',
  'Orientação Profissional',
  'Orientação Parental',
  'Psicoterapia de Casal',
];

const PUBLICOS = [
  'Criança', 'Adolescente', 'Adulto', 'Idoso', 'Casal',
  'Família', 'Mulher', 'Homem', 'LGBTQIAPN+', 'Outro',
];

/** Campos que só a gestão altera, com o motivo pelo qual estão travados. */
const TRAVADOS: Array<[string, (c: Cadastro) => string | undefined, string]> = [
  ['Nome completo', (c) => c.nomeCompleto, 'Conferido no credenciamento'],
  ['CRP', (c) => c.crp, 'Conferido no credenciamento'],
  ['E-mail', (c) => c.email, 'É a chave de acesso da sua conta'],
  ['Turma Viver Mais', (c) => c.turmaViverMais, 'Registro acadêmico'],
  ['Pós-graduação', (c) => c.posGraduacaoViverMais, 'Registro acadêmico'],
  ['Segunda pós-graduação', (c) => c.segundaPosGraduacao, 'Registro acadêmico'],
];

type Rascunho = {
  nomeSocial: string;
  whatsapp: string;
  estadoUf: string;
  cidade: string;
  logradouro: string;
  bairro: string;
  especialidade: string;
  minibio: string;
  modalidadeAtendimento: string;
  atendimentoPreferencia: 'PARTICULAR' | 'SOCIAL' | 'AMBOS';
  turnosDisponiveis: string[];
  servicosPrestados: string[];
  publicoAlvo: string[];
  publicoAlvoOutro: string;
  especificarNecessidades: boolean;
  necessidadesAtendidas: string[];
  necessidadesOutro: string;
};

function rascunhoDe(c: Cadastro): Rascunho {
  return {
    nomeSocial: c.nomeSocial ?? '',
    whatsapp: formatBrazilPhone(c.whatsapp) || c.whatsapp,
    estadoUf: c.estadoUf ?? '',
    cidade: c.cidade ?? '',
    logradouro: c.logradouro ?? '',
    bairro: c.bairro ?? '',
    especialidade: c.especialidade ?? '',
    minibio: c.minibio ?? '',
    modalidadeAtendimento: c.modalidadeAtendimento ?? 'AMBOS',
    atendimentoPreferencia: c.atendimentoPreferencia ?? 'AMBOS',
    turnosDisponiveis: [...(c.turnosDisponiveis ?? [])],
    servicosPrestados: [...(c.servicosPrestados ?? [])],
    publicoAlvo: [...(c.publicoAlvo ?? [])],
    publicoAlvoOutro: c.publicoAlvoOutro ?? '',
    especificarNecessidades: Boolean(c.especificarNecessidades),
    necessidadesAtendidas: [...(c.necessidadesAtendidas ?? [])],
    necessidadesOutro: c.necessidadesOutro ?? '',
  };
}

function alternar(lista: string[], valor: string): string[] {
  return lista.includes(valor) ? lista.filter((item) => item !== valor) : [...lista, valor];
}

function Chips({ itens }: { itens?: string[] }) {
  if (!itens?.length) return <p className="text-sm text-muted mt-1">Não informado</p>;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {itens.map((item) => (
        <span key={item} className="text-[11px] font-bold bg-psi-soft text-psi-deep px-2.5 py-1 rounded-lg">
          {item}
        </span>
      ))}
    </div>
  );
}

export default function MeuCadastroPage() {
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const carregar = async () => {
    try {
      const response = await fetch('/api/application/credenciamento-psicologo/me', { cache: 'no-store' });
      const body = (await response.json()) as { success: boolean; data?: Cadastro | null; error?: string };
      if (!response.ok || !body.success) throw new Error(body.error ?? 'Não foi possível carregar seu cadastro.');
      setCadastro(body.data ?? null);
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Falha de conexão.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(carregar);
  }, []);

  const info = useMemo(() => (cadastro ? statusInfo[cadastro.status] : null), [cadastro]);

  const abrirEdicao = () => {
    if (!cadastro) return;
    setRascunho(rascunhoDe(cadastro));
    setAviso(null);
    setEditando(true);
  };

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!rascunho) return;

    if (!normalizeBrazilPhone(rascunho.whatsapp)) {
      setAviso('Informe um telefone brasileiro válido com DDD.');
      return;
    }
    if (!rascunho.estadoUf || !rascunho.cidade) {
      setAviso('Selecione o estado e a cidade.');
      return;
    }
    if (!rascunho.logradouro.trim() || !rascunho.bairro.trim()) {
      setAviso('Informe rua/logradouro e bairro.');
      return;
    }
    if (rascunho.turnosDisponiveis.length === 0) {
      setAviso('Selecione ao menos um turno — é por ele que os encaminhamentos chegam até você.');
      return;
    }

    setSalvando(true);
    setAviso(null);
    try {
      const response = await fetch('/api/application/credenciamento-psicologo/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rascunho),
      });
      const body = (await response.json()) as { success: boolean; data?: Cadastro; error?: string };
      if (!response.ok || !body.success) throw new Error(body.error ?? 'Não foi possível salvar.');
      setCadastro(body.data ?? null);
      setEditando(false);
    } catch (error) {
      setAviso(error instanceof Error ? error.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return <div className="min-h-[60vh] grid place-items-center text-sm font-semibold text-muted">Carregando seu cadastro…</div>;
  }
  if (erro) {
    return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">{erro}</div>;
  }

  if (!cadastro || !info) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="bg-surface rounded-[2rem] border border-psi-soft p-8 shadow-card">
          <div className="w-12 h-12 rounded-2xl bg-psi-soft text-psi-deep grid place-items-center mb-5"><FileText className="w-6 h-6" /></div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-extrabold text-psi-vibrant">Meu cadastro profissional</p>
          <h1 className="text-3xl font-black text-ink mt-2">Ainda não encontramos uma candidatura vinculada</h1>
          <p className="text-sm text-muted leading-6 mt-4">Envie o formulário pela vitrine usando o mesmo e-mail desta conta profissional. Assim a gestão conseguirá revisar seu cadastro e você acompanhará o status por aqui.</p>
          <a href="/vitrine" className="mt-6 inline-flex items-center rounded-xl bg-psi-deep px-5 py-3 text-sm font-extrabold text-white hover:bg-psi-darkest">Abrir formulário da vitrine</a>
        </div>
      </div>
    );
  }

  const StatusIcon = info.icon;
  const colorClasses = info.color === 'emerald'
    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
    : info.color === 'rose'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : 'bg-amber-50 border-amber-200 text-amber-800';

  const campoClasse = 'w-full px-3.5 py-2.5 border border-line rounded-xl focus:outline-none focus:border-psi-vibrant text-sm bg-surface';
  const chipClasse = (marcado: boolean) =>
    `cursor-pointer px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
      marcado ? 'bg-psi-soft border-psi-vibrant text-psi-deep' : 'bg-surface border-line text-muted hover:border-psi-soft'
    }`;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] font-extrabold text-psi-vibrant">Área profissional</p>
          <h1 className="text-3xl font-black text-ink mt-1">Meu cadastro na Viver Mais</h1>
          <p className="text-sm text-muted mt-2">Estes são os dados que a clínica tem sobre a sua prática — e é por eles que os encaminhamentos chegam.</p>
        </div>
        {!editando && (
          <button onClick={abrirEdicao} className="inline-flex items-center gap-2 rounded-xl bg-psi-deep px-5 py-3 text-sm font-extrabold text-white hover:bg-psi-darkest">
            <Pencil className="w-4 h-4" /> Editar meu perfil
          </button>
        )}
      </div>

      <div className={`rounded-3xl border p-5 flex items-start gap-4 ${colorClasses}`}>
        <StatusIcon className="w-6 h-6 shrink-0 mt-0.5" />
        <div>
          <p className="font-black">{info.label}</p>
          <p className="text-sm mt-1 opacity-85">{info.description}</p>
          {cadastro.exibirNaVitrine === false && cadastro.motivoDesativacao && (
            <p className="text-sm mt-2 font-bold">Fora da vitrine: {cadastro.motivoDesativacao}</p>
          )}
        </div>
      </div>

      {aviso && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">{aviso}</div>
      )}

      {editando && rascunho ? (
        <form onSubmit={salvar} className="bg-surface rounded-3xl border border-line shadow-card p-6 space-y-6">
          <div className="flex items-center gap-3 border-b border-line pb-4">
            <Pencil className="w-5 h-5 text-psi-vibrant" />
            <h2 className="font-black text-ink">Editando meu perfil</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">Nome social</label>
              <input value={rascunho.nomeSocial} onChange={(e) => setRascunho({ ...rascunho, nomeSocial: e.target.value })} className={campoClasse} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">WhatsApp</label>
              <input value={rascunho.whatsapp} onChange={(e) => setRascunho({ ...rascunho, whatsapp: maskBrazilPhoneInput(e.target.value) })} className={campoClasse} />
            </div>
            <div className="sm:col-span-2">
              <BrazilLocationFields
                estadoUf={rascunho.estadoUf}
                cidade={rascunho.cidade}
                onEstadoChange={(estadoUf) => setRascunho({ ...rascunho, estadoUf, cidade: '' })}
                onCidadeChange={(cidade) => setRascunho({ ...rascunho, cidade })}
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">Rua / logradouro</label>
              <input required value={rascunho.logradouro} onChange={(e) => setRascunho({ ...rascunho, logradouro: e.target.value })} autoComplete="street-address" className={campoClasse} />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">Bairro</label>
              <input required value={rascunho.bairro} onChange={(e) => setRascunho({ ...rascunho, bairro: e.target.value })} autoComplete="address-level3" className={campoClasse} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">Especialidade ou abordagem</label>
              <input value={rascunho.especialidade} onChange={(e) => setRascunho({ ...rascunho, especialidade: e.target.value })} className={campoClasse} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-1.5">Apresentação</label>
              <textarea value={rascunho.minibio} maxLength={600} rows={4} onChange={(e) => setRascunho({ ...rascunho, minibio: e.target.value })} className={`${campoClasse} leading-6 resize-y`} />
              <p className="text-[10px] text-muted mt-1">{rascunho.minibio.length}/600 — é o texto que o paciente lê na vitrine.</p>
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-2">Turnos em que atendo</label>
            <div className="flex flex-wrap gap-2">
              {TURNOS.map((turno) => (
                <label key={turno.value} className={chipClasse(rascunho.turnosDisponiveis.includes(turno.value))}>
                  <input type="checkbox" className="sr-only" checked={rascunho.turnosDisponiveis.includes(turno.value)} onChange={() => setRascunho({ ...rascunho, turnosDisponiveis: alternar(rascunho.turnosDisponiveis, turno.value) })} />
                  {turno.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-2">Serviços que presto</label>
            <div className="flex flex-wrap gap-2">
              {SERVICOS.map((servico) => (
                <label key={servico} className={chipClasse(rascunho.servicosPrestados.includes(servico))}>
                  <input type="checkbox" className="sr-only" checked={rascunho.servicosPrestados.includes(servico)} onChange={() => setRascunho({ ...rascunho, servicosPrestados: alternar(rascunho.servicosPrestados, servico) })} />
                  {servico}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-2">Público que atendo</label>
            <div className="flex flex-wrap gap-2">
              {PUBLICOS.map((publico) => (
                <label key={publico} className={chipClasse(rascunho.publicoAlvo.includes(publico))}>
                  <input type="checkbox" className="sr-only" checked={rascunho.publicoAlvo.includes(publico)} onChange={() => setRascunho({ ...rascunho, publicoAlvo: alternar(rascunho.publicoAlvo, publico) })} />
                  {publico}
                </label>
              ))}
            </div>
            {rascunho.publicoAlvo.includes('Outro') && (
              <input value={rascunho.publicoAlvoOutro} onChange={(e) => setRascunho({ ...rascunho, publicoAlvoOutro: e.target.value })} placeholder="Qual outro público?" className={`${campoClasse} mt-3`} />
            )}
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-2">Atendo demandas específicas</label>
            <div className="flex gap-2 mb-3">
              {[{ v: true, l: 'Sim' }, { v: false, l: 'Não' }].map((opcao) => (
                <label key={String(opcao.v)} className={chipClasse(rascunho.especificarNecessidades === opcao.v)}>
                  <input type="radio" className="sr-only" checked={rascunho.especificarNecessidades === opcao.v} onChange={() => setRascunho({ ...rascunho, especificarNecessidades: opcao.v })} />
                  {opcao.l}
                </label>
              ))}
            </div>
            {rascunho.especificarNecessidades && (
              <>
                <div className="flex flex-wrap gap-2">
                  {LISTA_NECESSIDADES.map((necessidade) => (
                    <label key={necessidade} className={chipClasse(rascunho.necessidadesAtendidas.includes(necessidade))}>
                      <input type="checkbox" className="sr-only" checked={rascunho.necessidadesAtendidas.includes(necessidade)} onChange={() => setRascunho({ ...rascunho, necessidadesAtendidas: alternar(rascunho.necessidadesAtendidas, necessidade) })} />
                      {necessidade}
                    </label>
                  ))}
                </div>
                <input value={rascunho.necessidadesOutro} onChange={(e) => setRascunho({ ...rascunho, necessidadesOutro: e.target.value })} placeholder="Outra demanda que você atende" className={`${campoClasse} mt-3`} />
              </>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-2">Modalidade</label>
              <div className="flex flex-wrap gap-2">
                {['ONLINE', 'PRESENCIAL', 'AMBOS'].map((modalidade) => (
                  <label key={modalidade} className={chipClasse(rascunho.modalidadeAtendimento === modalidade)}>
                    <input type="radio" className="sr-only" checked={rascunho.modalidadeAtendimento === modalidade} onChange={() => setRascunho({ ...rascunho, modalidadeAtendimento: modalidade })} />
                    {modalidade}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider font-extrabold text-muted block mb-2">Tipo de atendimento</label>
              <div className="flex flex-wrap gap-2">
                {(['PARTICULAR', 'SOCIAL', 'AMBOS'] as const).map((tipo) => (
                  <label key={tipo} className={chipClasse(rascunho.atendimentoPreferencia === tipo)}>
                    <input type="radio" className="sr-only" checked={rascunho.atendimentoPreferencia === tipo} onChange={() => setRascunho({ ...rascunho, atendimentoPreferencia: tipo })} />
                    {tipo}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 border-t border-line pt-5">
            <button type="submit" disabled={salvando} className="rounded-xl bg-psi-deep px-6 py-3 text-sm font-extrabold text-white hover:bg-psi-darkest disabled:opacity-60">
              {salvando ? 'Salvando…' : 'Salvar alterações'}
            </button>
            <button type="button" onClick={() => setEditando(false)} className="rounded-xl border border-line px-6 py-3 text-sm font-extrabold text-muted hover:text-ink">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.7fr] gap-6">
          <div className="space-y-6">
            <section className="bg-surface rounded-3xl border border-line shadow-card p-6">
              <div className="flex items-center gap-3 border-b border-line pb-4">
                <ShieldCheck className="w-5 h-5 text-psi-vibrant" />
                <h2 className="font-black text-ink">Minha prática</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-5">
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Nome social</p><p className="text-sm font-bold text-ink mt-1">{cadastro.nomeSocial || 'Não informado'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">WhatsApp</p><p className="text-sm font-bold text-ink mt-1">{formatBrazilPhone(cadastro.whatsapp)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Estado</p><p className="text-sm font-bold text-ink mt-1">{cadastro.estadoUf || '—'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Cidade</p><p className="text-sm font-bold text-ink mt-1">{cadastro.cidade ?? cadastro.cidadeUf ?? '—'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Rua / logradouro</p><p className="text-sm font-bold text-ink mt-1">{cadastro.logradouro || '—'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Bairro</p><p className="text-sm font-bold text-ink mt-1">{cadastro.bairro || '—'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Gênero</p><p className="text-sm font-bold text-ink mt-1">{formatGender(cadastro.genero, cadastro.generoOutro) || '—'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Especialidade</p><p className="text-sm font-bold text-ink mt-1">{cadastro.especialidade || 'Não informado'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Modalidade</p><p className="text-sm font-bold text-ink mt-1">{cadastro.modalidadeAtendimento || '—'}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Tipo de atendimento</p><p className="text-sm font-bold text-ink mt-1">{cadastro.atendimentoPreferencia || '—'}</p></div>
              </div>

              <div className="border-t border-line mt-6 pt-5 space-y-5">
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Turnos em que atendo</p>
                  <Chips itens={cadastro.turnosDisponiveis?.map((t) => TURNOS.find((x) => x.value === t)?.label ?? t)} />
                  {!cadastro.turnosDisponiveis?.length && (
                    <p className="text-xs font-bold text-amber-700 mt-2">Sem turno definido, nenhum encaminhamento chega até você.</p>
                  )}
                </div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Serviços que presto</p><Chips itens={cadastro.servicosPrestados} /></div>
                <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Público que atendo</p><Chips itens={[...(cadastro.publicoAlvo ?? []), ...(cadastro.publicoAlvoOutro ? [cadastro.publicoAlvoOutro] : [])]} /></div>
                {cadastro.especificarNecessidades && (
                  <div><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Demandas específicas</p><Chips itens={[...(cadastro.necessidadesAtendidas ?? []), ...(cadastro.necessidadesOutro ? [cadastro.necessidadesOutro] : [])]} /></div>
                )}
              </div>

              {cadastro.minibio && (
                <div className="border-t border-line mt-6 pt-5">
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Apresentação</p>
                  <p className="text-sm leading-6 text-ink mt-1">{cadastro.minibio}</p>
                </div>
              )}
            </section>

            <section className="bg-surface rounded-3xl border border-line shadow-card p-6">
              <div className="flex items-center gap-3 border-b border-line pb-4">
                <Lock className="w-5 h-5 text-muted" />
                <h2 className="font-black text-ink">Definido pela gestão</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-5">
                {TRAVADOS.map(([label, valor, motivo]) => (
                  <div key={label}>
                    <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">{label}</p>
                    <p className="text-sm font-bold text-ink mt-1">{valor(cadastro) || '—'}</p>
                    <p className="text-[10px] text-muted mt-0.5">{motivo}</p>
                  </div>
                ))}
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Pacientes ativos</p>
                  <p className="text-sm font-bold text-ink mt-1">
                    {cadastro.pacientesAtivosCount ?? 0} de {cadastro.limitePacientesAtivos ?? 5}
                  </p>
                  <p className="text-[10px] text-muted mt-0.5">Capacidade definida pela clínica</p>
                </div>
              </div>
            </section>
          </div>

          <aside className="bg-psi-darkest rounded-3xl p-6 text-white shadow-contrast h-fit">
            <Info className="w-5 h-5 text-psi-vibrant" />
            <h2 className="font-black mt-4">Como funciona</h2>
            <ol className="mt-4 space-y-4 text-sm text-white/70">
              <li><strong className="text-white">1. Enviado</strong><br />Seu formulário fica registrado no banco da clínica.</li>
              <li><strong className="text-white">2. Conferência</strong><br />A gestão valida CRP, especialidades e disponibilidade.</li>
              <li><strong className="text-white">3. Publicado</strong><br />Após aprovação, seu perfil entra na vitrine e no rodízio.</li>
            </ol>
            <p className="mt-6 pt-4 border-t border-white/10 text-xs text-white/50 leading-5">
              Turnos, serviços e público-alvo são os critérios usados para encaminhar pacientes a você. Mantê-los atualizados muda o que você recebe.
            </p>
            <p className="mt-4 text-xs text-white/50 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Dúvidas? Fale com a coordenação da clínica.</p>
          </aside>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Info, Mail, ShieldCheck, XCircle } from 'lucide-react';
import { formatBrazilPhone } from '@/lib/brazilPhone';
import { formatGender } from '@/lib/gender';

interface Cadastro {
  nomeCompleto: string;
  nomeSocial?: string;
  crp: string;
  whatsapp: string;
  email?: string;
  cidadeUf?: string;
  estadoUf?: string;
  cidade?: string;
  genero?: string;
  generoOutro?: string;
  especialidade?: string;
  modalidadeAtendimento?: string;
  minibio?: string;
  status: 'EM_ANALISE' | 'APROVADO' | 'RECUSADO';
  turmaViverMais?: string;
  posGraduacaoViverMais?: string;
  segundaPosGraduacao?: string;
  servicosHabilitados?: string[];
}

const statusInfo = {
  EM_ANALISE: { label: 'Em análise pela gestão', description: 'A gestão recebeu seu cadastro e está conferindo as informações profissionais.', icon: Clock3, color: 'amber' },
  APROVADO: { label: 'Aprovado e publicado', description: 'Seu perfil está disponível na vitrine e elegível para receber novos pacientes.', icon: CheckCircle2, color: 'emerald' },
  RECUSADO: { label: 'Cadastro recusado', description: 'A gestão solicitou que este cadastro seja revisado antes de uma nova análise.', icon: XCircle, color: 'rose' },
} as const;

export default function MeuCadastroPage() {
  const [cadastro, setCadastro] = useState<Cadastro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/application/credenciamento-psicologo/me', { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { success: boolean; data?: Cadastro | null; error?: string };
        if (!response.ok || !body.success) throw new Error(body.error ?? 'Não foi possível carregar seu cadastro.');
        setCadastro(body.data ?? null);
      })
      .catch((error) => setErro(error instanceof Error ? error.message : 'Falha de conexão.'))
      .finally(() => setCarregando(false));
  }, []);

  if (carregando) return <div className="min-h-[60vh] grid place-items-center text-sm font-semibold text-muted">Carregando seu cadastro…</div>;
  if (erro) return <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-800">{erro}</div>;

  if (!cadastro) {
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

  const info = statusInfo[cadastro.status];
  const StatusIcon = info.icon;
  const colorClasses = info.color === 'emerald' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : info.color === 'rose' ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-amber-50 border-amber-200 text-amber-800';
  const campos = [
    ['Nome completo', cadastro.nomeCompleto], ['Nome social', cadastro.nomeSocial], ['CRP', cadastro.crp],
    ['WhatsApp', formatBrazilPhone(cadastro.whatsapp)], ['E-mail', cadastro.email],
    ['Estado', cadastro.estadoUf], ['Cidade', cadastro.cidade ?? cadastro.cidadeUf],
    ['Gênero', formatGender(cadastro.genero, cadastro.generoOutro)],
    ['Especialidade', cadastro.especialidade], ['Modalidade', cadastro.modalidadeAtendimento],
    ['Turma Viver Mais', cadastro.turmaViverMais], ['Pós-graduação', cadastro.posGraduacaoViverMais],
    ['Segunda pós-graduação', cadastro.segundaPosGraduacao],
  ].filter(([, valor]) => valor);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div><p className="text-[10px] uppercase tracking-[0.22em] font-extrabold text-psi-vibrant">Área profissional</p><h1 className="text-3xl font-black text-ink mt-1">Meu cadastro na Viver Mais</h1><p className="text-sm text-muted mt-2">Acompanhe a conferência do seu perfil e veja exatamente os dados enviados.</p></div>
      <div className={`rounded-3xl border p-5 flex items-start gap-4 ${colorClasses}`}><StatusIcon className="w-6 h-6 shrink-0 mt-0.5" /><div><p className="font-black">{info.label}</p><p className="text-sm mt-1 opacity-85">{info.description}</p></div></div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_0.7fr] gap-6">
        <section className="bg-surface rounded-3xl border border-line shadow-card p-6">
          <div className="flex items-center gap-3 border-b border-line pb-4"><ShieldCheck className="w-5 h-5 text-psi-vibrant" /><h2 className="font-black text-ink">Dados enviados</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5 mt-5">{campos.map(([label, valor]) => <div key={label}><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">{label}</p><p className="text-sm font-bold text-ink mt-1">{valor}</p></div>)}</div>
          {cadastro.minibio && <div className="border-t border-line mt-6 pt-5"><p className="text-[10px] uppercase tracking-wider font-extrabold text-muted">Minibio</p><p className="text-sm leading-6 text-ink mt-1">{cadastro.minibio}</p></div>}
        </section>
        <aside className="bg-psi-darkest rounded-3xl p-6 text-white shadow-contrast h-fit"><Info className="w-5 h-5 text-psi-vibrant" /><h2 className="font-black mt-4">Como funciona</h2><ol className="mt-4 space-y-4 text-sm text-white/70"><li><strong className="text-white">1. Enviado</strong><br />Seu formulário fica registrado no banco da clínica.</li><li><strong className="text-white">2. Conferência</strong><br />A gestão valida CRP, especialidades e disponibilidade.</li><li><strong className="text-white">3. Publicado</strong><br />Após aprovação, seu perfil entra na vitrine e no rodízio.</li></ol><p className="mt-6 pt-4 border-t border-white/10 text-xs text-white/50 flex items-center gap-2"><Mail className="w-3.5 h-3.5" /> Dúvidas? Fale com a coordenação da clínica.</p></aside>
      </div>
    </div>
  );
}

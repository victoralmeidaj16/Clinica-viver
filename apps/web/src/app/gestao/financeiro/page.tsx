'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { MotivoCancelamentoNfse } from '@thats-life/core';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  CreditCard,
  FileText,
  FileSpreadsheet,
  Filter,
  Percent,
  RefreshCw,
  Search,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import {
  NfsePreviewModal,
  type NfseEmissao,
  type NfsePreview,
} from '@/components/financial/NfsePreviewModal';
import {
  nfseRowAction,
  nfseRowTone,
  type NfseRowStatus,
} from '@/components/financial/nfsePresentation';

/**
 * Financeiro da clínica.
 *
 * É o espelho de `/meu-financeiro`: o psicólogo vê o crédito de 70% que
 * acumulou; a gestão vê o mesmo movimento pelo outro lado — quanto entrou,
 * quanto vira receita da clínica e quanto está devendo a quem atendeu.
 *
 * Nada aqui é calculado no navegador: os totais vêm do motor financeiro por
 * `/api/application/financial/clinica`, que é a mesma conciliação usada no
 * relatório e na exportação. Uma segunda conta na tela seria uma segunda
 * verdade, e a que discorda do banco é sempre a que aparece em reunião.
 */

interface Atendimento {
  chargeId: string;
  patientId: string;
  sessionId: string;
  pacienteNome: string;
  psicologoId: string;
  psicologoNome: string;
  vencimentoEm: string;
  status: 'draft' | 'paid' | 'pending' | 'partially_paid' | 'overdue' | 'refunded' | 'cancelled';
  valorLiquidoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  creditoPsicologoCents: number;
  receitaClinicaCents: number;
  nfseStatus: NfseRowStatus;
  nfseNumero?: string;
}

interface ConsolidadoPsicologo {
  psicologoId: string;
  psicologoNome: string;
  atendimentos: number;
  faturadoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  creditoPsicologoCents: number;
  receitaClinicaCents: number;
}

interface Panorama {
  periodo: { inicio?: string; fim?: string };
  geradoEm: string;
  resumo: {
    atendimentos: number;
    liquidados: number;
    vencidos: number;
    faturadoCents: number;
    recebidoCents: number;
    emAbertoCents: number;
    vencidoCents: number;
    inadimplencia: number;
    creditoPsicologosCents: number;
    receitaClinicaCents: number;
  };
  atendimentos: Atendimento[];
  porPsicologo: ConsolidadoPsicologo[];
}

const dinheiro = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

const dataBr = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));

const rotuloStatus: Record<Atendimento['status'], string> = {
  draft: 'Rascunho',
  paid: 'Pago',
  pending: 'Pendente',
  partially_paid: 'Parcial',
  overdue: 'Vencido',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

const estiloStatus: Record<Atendimento['status'], string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  paid: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  pending: 'bg-sky-100 text-sky-800 border-sky-200',
  partially_paid: 'bg-amber-100 text-amber-800 border-amber-200',
  overdue: 'bg-rose-100 text-rose-800 border-rose-200',
  refunded: 'bg-slate-100 text-slate-700 border-slate-200',
  cancelled: 'bg-slate-100 text-slate-500 border-slate-200',
};

/** `AAAA-MM-DD` no fuso de quem está olhando, sem passar por UTC. */
function diaLocal(data: Date): string {
  const mes = `${data.getMonth() + 1}`.padStart(2, '0');
  const dia = `${data.getDate()}`.padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

export default function FinanceiroClinicaPage() {
  // O período abre no mês corrente, que é o recorte que a gestão consulta no
  // dia a dia. Ler o relógio no estado inicial é seguro aqui porque o
  // `LayoutShell` só monta a página depois de confirmar a sessão, já no
  // navegador — esta árvore nunca é renderizada no servidor.
  const [dataInicio, setDataInicio] = useState(() => {
    const hoje = new Date();
    return diaLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
  });
  const [dataFim, setDataFim] = useState(() => diaLocal(new Date()));
  // O período aplicado é separado dos campos: enquanto a data é digitada o
  // navegador dispara `change` a cada parte preenchida, e buscar em cada uma
  // delas trocaria a tabela debaixo de quem ainda está escolhendo o intervalo.
  const [periodo, setPeriodo] = useState(() => ({ inicio: dataInicio, fim: dataFim }));
  const [panorama, setPanorama] = useState<Panorama | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState<'TODOS' | Atendimento['status']>('TODOS');
  const [exportando, setExportando] = useState(false);
  const [nfseAberta, setNfseAberta] = useState(false);
  const [cobrancaNfseId, setCobrancaNfseId] = useState<string | null>(null);
  const [previaNfse, setPreviaNfse] = useState<NfsePreview | null>(null);
  const [emissaoNfse, setEmissaoNfse] = useState<NfseEmissao | null>(null);
  const [carregandoNfse, setCarregandoNfse] = useState(false);
  const [emitindoNfse, setEmitindoNfse] = useState(false);
  const [cancelandoNfse, setCancelandoNfse] = useState(false);
  const [salvandoCpf, setSalvandoCpf] = useState(false);
  const [erroNfse, setErroNfse] = useState('');
  const [sucessoNfse, setSucessoNfse] = useState('');
  // Quem pode emitir nota é a administração. O servidor já recusava o resto,
  // mas o botão aparecia para todo mundo — e um botão que só devolve 403 é uma
  // promessa falsa, não uma proteção.
  const [eAdmin, setEAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelado = false;
    applicationRequest<{ role: 'admin' | 'psicologo' }>('/../auth/me')
      .then((sessao) => { if (!cancelado) setEAdmin(sessao.role === 'admin'); })
      .catch(() => { if (!cancelado) setEAdmin(false); });
    return () => { cancelado = true; };
  }, []);

  // A busca sai da renderização e uma resposta antiga nunca sobrescreve a
  // atual: quem troca o período duas vezes seguidas vê o resultado do segundo
  // filtro, não o do primeiro que por acaso chegou depois.
  useEffect(() => {
    if (!periodo.inicio || !periodo.fim) return;
    let cancelado = false;

    const timer = window.setTimeout(async () => {
      setCarregando(true);
      setErro('');
      try {
        const dados = await applicationRequest<Panorama>(
          `/financial/clinica?startDate=${periodo.inicio}&endDate=${periodo.fim}`
        );
        if (!cancelado) setPanorama(dados);
      } catch (causa) {
        if (cancelado) return;
        setErro(causa instanceof Error ? causa.message : 'Não foi possível carregar o financeiro.');
        setPanorama(null);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    }, 0);

    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [periodo]);

  // Um objeto novo a cada envio: assim o botão também serve para recarregar o
  // mesmo intervalo, sem virar um caso especial.
  const filtrarPeriodo = (evento: React.FormEvent) => {
    evento.preventDefault();
    setPeriodo({ inicio: dataInicio, fim: dataFim });
  };

  const exportarCsv = async () => {
    setExportando(true);
    setErro('');
    try {
      // O relatório sai do período que está na tela, não do que está sendo
      // digitado no filtro — o arquivo tem que conferir com o que foi lido.
      const resposta = await fetch(
        `/api/application/financial/clinica?startDate=${periodo.inicio}&endDate=${periodo.fim}&format=csv`,
        { cache: 'no-store' }
      );
      if (!resposta.ok) throw new Error('Não foi possível gerar o relatório.');
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = `financeiro-clinica-${periodo.inicio}-a-${periodo.fim}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível gerar o relatório.');
    } finally {
      setExportando(false);
    }
  };

  const abrirPreviaNfse = async (chargeId: string) => {
    setNfseAberta(true);
    setCobrancaNfseId(chargeId);
    setPreviaNfse(null);
    setEmissaoNfse(null);
    setErroNfse('');
    setSucessoNfse('');
    setCarregandoNfse(true);
    try {
      const caminho = `/financial/clinica/${encodeURIComponent(chargeId)}/nfse`;
      const [resultadoPrevia, resultadoEmissao] = await Promise.allSettled([
        applicationRequest<NfsePreview>(`${caminho}/preview`),
        applicationRequest<NfseEmissao>(caminho),
      ]);

      const previa = resultadoPrevia.status === 'fulfilled' ? resultadoPrevia.value : null;
      const emissao = resultadoEmissao.status === 'fulfilled'
        ? resultadoEmissao.value
        : ({ status: 'none' } as NfseEmissao);
      setPreviaNfse(previa);
      setEmissaoNfse(emissao);

      // Uma nota já emitida continua consultável mesmo quando a cobrança passa
      // a exigir revisão (por exemplo, após estorno). A falha da nova prévia não
      // pode esconder XML, número e cancelamento que já existem.
      if (!previa && emissao.status === 'none') {
        const causa = resultadoPrevia.status === 'rejected'
          ? resultadoPrevia.reason
          : resultadoEmissao.status === 'rejected'
            ? resultadoEmissao.reason
            : null;
        setErroNfse(causa instanceof Error ? causa.message : 'Não foi possível preparar a NFS-e.');
      } else if (!previa && resultadoPrevia.status === 'rejected') {
        setErroNfse(
          resultadoPrevia.reason instanceof Error
            ? resultadoPrevia.reason.message
            : 'A nota pode ser consultada, mas os dados atuais da cobrança exigem revisão.'
        );
      }
    } finally {
      setCarregandoNfse(false);
    }
  };

  const atualizarLinhaNfse = (chargeId: string, emissao: NfseEmissao) => {
    setPanorama((atual) => atual
      ? {
          ...atual,
          atendimentos: atual.atendimentos.map((item) => item.chargeId === chargeId
            ? { ...item, nfseStatus: emissao.status, nfseNumero: emissao.numeroNfse }
            : item),
        }
      : atual);
  };

  const confirmarEmissaoNfse = async () => {
    if (!previaNfse) return;
    setEmitindoNfse(true);
    setErroNfse('');
    try {
      const resultado = await applicationRequest<{
        status: 'issued'; numeroNfse?: string; ambiente: string;
        emailStatus?: 'sending' | 'sent' | 'failed'; emailDestinatario?: string;
      }>(
        `/financial/clinica/${encodeURIComponent(previaNfse.chargeId)}/nfse`,
        { method: 'POST', headers: commandHeaders(), body: JSON.stringify({ confirmar: true }) }
      );
      const identificacao = `NFS-e${resultado.numeroNfse ? ` nº ${resultado.numeroNfse}` : ''}`;
      setSucessoNfse(resultado.emailStatus === 'sent'
        ? `${identificacao} emitida e enviada para ${resultado.emailDestinatario}.`
        : `${identificacao} emitida com sucesso. Confira abaixo a situação do envio por e-mail.`);
      const emissao = await applicationRequest<NfseEmissao>(
        `/financial/clinica/${encodeURIComponent(previaNfse.chargeId)}/nfse`
      );
      setEmissaoNfse(emissao);
      atualizarLinhaNfse(previaNfse.chargeId, emissao);
    } catch (causa) {
      setErroNfse(causa instanceof Error ? causa.message : 'Não foi possível emitir a NFS-e.');
    } finally {
      setEmitindoNfse(false);
    }
  };

  const cancelarEmissaoNfse = async (motivo: string, codigoMotivo: MotivoCancelamentoNfse) => {
    if (!cobrancaNfseId) return;
    setCancelandoNfse(true);
    setErroNfse('');
    try {
      await applicationRequest(
        `/financial/clinica/${encodeURIComponent(cobrancaNfseId)}/nfse/cancelar`,
        {
          method: 'POST',
          headers: commandHeaders(),
          body: JSON.stringify({ confirmar: true, motivo, codigoMotivo }),
        }
      );
      setSucessoNfse('NFS-e cancelada com sucesso.');
      const emissao = await applicationRequest<NfseEmissao>(
        `/financial/clinica/${encodeURIComponent(cobrancaNfseId)}/nfse`
      );
      setEmissaoNfse(emissao);
      atualizarLinhaNfse(cobrancaNfseId, emissao);
    } catch (causa) {
      setErroNfse(causa instanceof Error ? causa.message : 'Não foi possível cancelar a NFS-e.');
    } finally {
      setCancelandoNfse(false);
    }
  };

  const salvarCpfDaNfse = async (cpf: string) => {
    if (!previaNfse) return;
    setSalvandoCpf(true);
    setErroNfse('');
    try {
      await applicationRequest(
        `/gestao/pacientes/${encodeURIComponent(previaNfse.paciente.ref)}/cpf`,
        { method: 'PUT', body: JSON.stringify({ cpf }) }
      );
      const previaAtualizada = await applicationRequest<NfsePreview>(
        `/financial/clinica/${encodeURIComponent(previaNfse.chargeId)}/nfse/preview`
      );
      setPreviaNfse(previaAtualizada);
      setSucessoNfse('CPF salvo. Confira os dados antes de emitir.');
    } catch (causa) {
      setErroNfse(causa instanceof Error ? causa.message : 'Não foi possível salvar o CPF.');
    } finally {
      setSalvandoCpf(false);
    }
  };

  const urlXmlNfse = (tipo: 'nfse' | 'dps') => {
    if (!cobrancaNfseId) return '#';
    return `/api/application/financial/clinica/${encodeURIComponent(cobrancaNfseId)}/nfse/xml?tipo=${tipo}`;
  };

  const urlPdfNfse = (download = false) => {
    if (!cobrancaNfseId) return '#';
    const base = `/api/application/financial/clinica/${encodeURIComponent(cobrancaNfseId)}/nfse/pdf`;
    return download ? `${base}?download=1` : base;
  };

  const atendimentos = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    return (panorama?.atendimentos ?? []).filter((item) => {
      const combina =
        !termo ||
        [item.pacienteNome, item.psicologoNome, item.chargeId, item.sessionId].some((valor) =>
          valor.toLocaleLowerCase('pt-BR').includes(termo)
        );
      return combina && (status === 'TODOS' || item.status === status);
    });
  }, [panorama, busca, status]);

  const resumo = panorama?.resumo;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="chip-accent text-[11px] mb-1">Extrato Financeiro da Clínica</span>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-psi-vibrant" />
            Financeiro & Repasses da Clínica
          </h1>
          <p className="text-xs text-muted">
            O outro lado do extrato do psicólogo: quanto entrou no período, quanto é receita da
            clínica (30%) e quanto está reservado como crédito de abatimento dos alunos (70%).
          </p>
        </div>

        <button
          type="button"
          onClick={() => void exportarCsv()}
          disabled={exportando || !periodo.inicio || !periodo.fim}
          className="bg-surface hover:bg-slate-50 text-ink border border-line font-extrabold text-xs px-4 py-2.5 rounded-2xl shadow-card transition-all flex items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          {exportando ? 'Gerando…' : 'Exportar Relatório (CSV)'}
        </button>
      </div>

      {/* Filtro de período */}
      <form
        onSubmit={filtrarPeriodo}
        className="bg-surface p-5 rounded-3xl border border-line shadow-card flex flex-col sm:flex-row sm:items-end justify-between gap-4 text-xs"
      >
        <div className="flex flex-col sm:flex-row items-center gap-4 flex-1">
          <div className="w-full sm:w-auto">
            <label className="font-bold text-ink block mb-1" htmlFor="data-inicio">
              Data Inicial
            </label>
            <input
              id="data-inicio"
              type="date"
              value={dataInicio}
              onChange={(evento) => setDataInicio(evento.target.value)}
              className="bg-slate-50 border border-line rounded-xl p-2.5 text-ink font-semibold focus:outline-none focus:border-psi-vibrant w-full"
            />
          </div>

          <div className="w-full sm:w-auto">
            <label className="font-bold text-ink block mb-1" htmlFor="data-fim">
              Data Final
            </label>
            <input
              id="data-fim"
              type="date"
              value={dataFim}
              onChange={(evento) => setDataFim(evento.target.value)}
              className="bg-slate-50 border border-line rounded-xl p-2.5 text-ink font-semibold focus:outline-none focus:border-psi-vibrant w-full"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={carregando}
          className="bg-psi-vibrant text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-md hover:bg-psi-vibrant/90 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {carregando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
          {carregando ? 'Carregando…' : 'Filtrar Período'}
        </button>
      </form>

      {erro && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {erro}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-gradient-to-br from-psi-darkest to-slate-900 text-white rounded-3xl p-6 shadow-contrast relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-psi-soft/80">Receita da Clínica (30%)</span>
            <div className="p-2 rounded-xl bg-psi-vibrant/20 text-psi-vibrant border border-psi-vibrant/30">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h2 className="text-3xl font-black text-white">
              {dinheiro(resumo?.receitaClinicaCents ?? 0)}
            </h2>
            <p className="text-[11px] text-psi-soft/70 font-semibold mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Sobre {dinheiro(resumo?.recebidoCents ?? 0)} efetivamente recebidos no período
            </p>
          </div>
          <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-psi-soft/50">
                Crédito dos psicólogos (70%)
              </p>
              <p className="text-lg font-black text-emerald-400">
                {dinheiro(resumo?.creditoPsicologosCents ?? 0)}
              </p>
            </div>
            <Percent className="w-5 h-5 text-emerald-400/70" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3 gap-5 lg:col-span-2">
          <article className="bg-surface rounded-3xl border border-line shadow-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted">
                Faturado no período
              </span>
              <TrendingUp className="w-4 h-4 text-psi-vibrant" />
            </div>
            <p className="mt-4 text-2xl font-black text-ink">{dinheiro(resumo?.faturadoCents ?? 0)}</p>
            <p className="mt-1 text-[11px] text-muted">
              {resumo?.atendimentos ?? 0} atendimentos · {resumo?.liquidados ?? 0} liquidados
            </p>
          </article>

          <article className="bg-surface rounded-3xl border border-line shadow-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted">
                Recebido
              </span>
              <Wallet className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="mt-4 text-2xl font-black text-emerald-700">
              {dinheiro(resumo?.recebidoCents ?? 0)}
            </p>
            <p className="mt-1 text-[11px] text-muted">Pagamentos confirmados menos estornos</p>
          </article>

          <article className="bg-surface rounded-3xl border border-line shadow-card p-5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted">
                Em aberto
              </span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="mt-4 text-2xl font-black text-ink">{dinheiro(resumo?.emAbertoCents ?? 0)}</p>
            <p className="mt-1 text-[11px] text-muted">
              {dinheiro(resumo?.vencidoCents ?? 0)} vencidos ·{' '}
              {((resumo?.inadimplencia ?? 0) * 100).toFixed(1).replace('.', ',')}% de inadimplência
            </p>
          </article>
        </div>
      </div>

      {/* Consolidado por psicólogo */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line flex items-center justify-between gap-4">
          <div>
            <h3 className="font-extrabold text-base text-ink flex items-center gap-2">
              <Users className="w-4 h-4 text-psi-vibrant" />
              Consolidado por Psicólogo
            </h3>
            <p className="text-xs text-muted">
              Quanto cada psicólogo gerou e quanto tem de crédito a abater na mensalidade
            </p>
          </div>
          <span className="chip text-[11px] whitespace-nowrap">
            {panorama?.porPsicologo.length ?? 0} psicólogos
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Psicólogo</th>
                <th className="px-6 py-4">Atendimentos</th>
                <th className="px-6 py-4">Faturado</th>
                <th className="px-6 py-4">Recebido</th>
                <th className="px-6 py-4">Em aberto</th>
                <th className="px-6 py-4 text-emerald-700">Crédito (70%)</th>
                <th className="px-6 py-4 text-psi-deep">Clínica (30%)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(panorama?.porPsicologo ?? []).map((item) => (
                <tr key={item.psicologoId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4 font-extrabold text-ink">{item.psicologoNome}</td>
                  <td className="px-6 py-4 text-muted">{item.atendimentos}</td>
                  <td className="px-6 py-4 font-bold text-ink">{dinheiro(item.faturadoCents)}</td>
                  <td className="px-6 py-4 font-bold text-emerald-700">
                    {dinheiro(item.recebidoCents)}
                  </td>
                  <td
                    className={`px-6 py-4 font-semibold ${
                      item.emAbertoCents > 0 ? 'text-rose-700' : 'text-muted'
                    }`}
                  >
                    {dinheiro(item.emAbertoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-emerald-600 bg-emerald-50/50">
                    {dinheiro(item.creditoPsicologoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-psi-deep">
                    {dinheiro(item.receitaClinicaCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!carregando && (panorama?.porPsicologo.length ?? 0) === 0 && (
            <p className="p-10 text-center text-xs text-muted">
              Nenhum atendimento com cobrança registrada nesse período.
            </p>
          )}
        </div>
      </div>

      {/* Atendimentos */}
      <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden">
        <div className="p-6 border-b border-line space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-ink">Atendimentos no Período</h3>
              <p className="text-xs text-muted">
                Cobranças conciliadas pelo motor financeiro, sessão por sessão
              </p>
            </div>
            <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-3 py-1 rounded-full border border-emerald-200 whitespace-nowrap">
              {atendimentos.length} de {panorama?.atendimentos.length ?? 0} atendimentos
            </span>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="relative sm:col-span-2 lg:col-span-3">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted" />
              <input
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                className="input py-2.5 pl-9 text-xs"
                placeholder="Paciente, psicólogo ou cobrança"
              />
            </label>
            <select
              className="input py-2.5 text-xs"
              value={status}
              onChange={(evento) => setStatus(evento.target.value as typeof status)}
            >
              <option value="TODOS">Todos os status</option>
              <option value="paid">Pago</option>
              <option value="pending">Pendente</option>
              <option value="partially_paid">Parcial</option>
              <option value="overdue">Vencido</option>
              <option value="refunded">Estornado</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-line">
              <tr>
                <th className="px-6 py-4">Paciente</th>
                <th className="px-6 py-4">Psicólogo</th>
                <th className="px-6 py-4">Vencimento</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Recebido</th>
                <th className="px-6 py-4 text-emerald-700">Crédito (70%)</th>
                <th className="px-6 py-4 text-psi-deep">Clínica (30%)</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">NFS-e</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {atendimentos.map((item) => {
                const acaoNfse = nfseRowAction({
                  paymentStatus: item.status,
                  nfseStatus: item.nfseStatus,
                  isAdmin: eAdmin === true,
                  numero: item.nfseNumero,
                });
                return (
                <tr key={item.chargeId} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-extrabold text-ink">{item.pacienteNome}</p>
                    <p className="text-[10px] text-muted font-mono">{item.sessionId}</p>
                  </td>
                  <td className="px-6 py-4 font-semibold text-ink">{item.psicologoNome}</td>
                  <td className="px-6 py-4 text-muted">{dataBr(item.vencimentoEm)}</td>
                  <td className="px-6 py-4 font-bold text-ink">{dinheiro(item.valorLiquidoCents)}</td>
                  <td className="px-6 py-4 font-semibold text-emerald-700">
                    {dinheiro(item.recebidoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-emerald-600 bg-emerald-50/50">
                    {dinheiro(item.creditoPsicologoCents)}
                  </td>
                  <td className="px-6 py-4 font-black text-psi-deep">
                    {dinheiro(item.receitaClinicaCents)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-extrabold px-2.5 py-1 rounded-full border ${estiloStatus[item.status]}`}
                    >
                      {rotuloStatus[item.status]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {acaoNfse.clickable ? (
                      <button
                        type="button"
                        onClick={() => void abrirPreviaNfse(item.chargeId)}
                        className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-extrabold transition-colors ${nfseRowTone[acaoNfse.tone]}`}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        {acaoNfse.label}
                      </button>
                    ) : (
                      <span className="text-[10px] font-semibold text-muted">{acaoNfse.label}</span>
                    )}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>

          {carregando && (
            <p className="p-10 text-center text-xs text-muted">Carregando o período…</p>
          )}
          {!carregando && atendimentos.length === 0 && (
            <p className="p-10 text-center text-xs text-muted">
              {(panorama?.atendimentos.length ?? 0) === 0
                ? 'Nenhuma cobrança foi registrada nesse período. As cobranças nascem no fechamento da sessão, no cockpit do psicólogo.'
                : 'Nenhum atendimento corresponde a esse filtro.'}
            </p>
          )}
        </div>
      </div>

      {panorama && (
        <p className="text-center text-[10px] text-muted">
          Apurado em {new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'America/Sao_Paulo',
          }).format(new Date(panorama.geradoEm))}
        </p>
      )}

      {nfseAberta && (
        <NfsePreviewModal
          previa={previaNfse}
          emissao={emissaoNfse}
          carregando={carregandoNfse}
          erro={erroNfse}
          sucesso={sucessoNfse}
          emitindo={emitindoNfse}
          cancelando={cancelandoNfse}
          salvandoCpf={salvandoCpf}
          onConfirmar={() => void confirmarEmissaoNfse()}
          onCancelar={(motivo, codigoMotivo) => void cancelarEmissaoNfse(motivo, codigoMotivo)}
          onSalvarCpf={(cpf) => void salvarCpfDaNfse(cpf)}
          onFechar={() => setNfseAberta(false)}
          urlXml={urlXmlNfse}
          urlPdf={urlPdfNfse}
        />
      )}
    </div>
  );
}

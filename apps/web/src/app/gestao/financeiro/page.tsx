'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { MotivoCancelamentoNfse } from '@thats-life/core';
import { AlertTriangle, Search } from 'lucide-react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import {
  NfsePreviewModal,
  type NfseEmissao,
  type NfsePreview,
} from '@/components/financial/NfsePreviewModal';
import { PatientPackagePanel } from '@/components/financial/PatientPackagePanel';
import { EducationalCreditPanel } from '@/components/financial/EducationalCreditPanel';
import { ClinicReceivablesTable, type Atendimento } from '@/components/financial/ClinicReceivablesTable';
import { ConsolidadoPorPsicologo, FinanceiroCabecalho, FinanceiroIndicadores, type ConsolidadoPsicologo, type ResumoFinanceiro } from '@/components/financial/FinanceiroResumo';

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



interface Panorama {
  periodo: { inicio?: string; fim?: string };
  geradoEm: string;
  resumo: ResumoFinanceiro;
  atendimentos: Atendimento[];
  porPsicologo: ConsolidadoPsicologo[];
}


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
    applicationRequest<{ role: 'admin' | 'financeiro' | 'psicologo' }>('/../auth/me')
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
        [item.pacienteNome, item.psicologoNome, item.convenioNome, item.chargeId, item.sessionId].some((valor) =>
          valor?.toLocaleLowerCase('pt-BR').includes(termo)
        );
      return combina && (status === 'TODOS' || item.status === status);
    });
  }, [panorama, busca, status]);

  const resumo = panorama?.resumo;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <FinanceiroCabecalho
        dataInicio={dataInicio}
        dataFim={dataFim}
        onDataInicio={setDataInicio}
        onDataFim={setDataFim}
        onFiltrar={filtrarPeriodo}
        carregando={carregando}
        exportando={exportando}
        podeExportar={Boolean(periodo.inicio && periodo.fim)}
        onExportar={() => void exportarCsv()}
      />

      {erro && (
        <div role="alert" className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-700">
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0" />
          {erro}
        </div>
      )}

      <FinanceiroIndicadores resumo={resumo} />
      <ConsolidadoPorPsicologo linhas={panorama?.porPsicologo ?? []} carregando={carregando} />

      {/* Atendimentos */}
      <section className="overflow-hidden rounded-2xl border border-psi-soft/60 bg-surface shadow-card">
        <div className="space-y-4 border-b border-psi-soft/60 p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-black text-psi-darkest">Atendimentos no período</h2>
              <p className="text-xs text-muted">
                Cobranças conciliadas pelo motor financeiro, sessão por sessão
              </p>
            </div>
            <span className="whitespace-nowrap rounded-lg border border-psi-soft bg-white px-2 py-0.5 text-xs font-extrabold text-psi-darkest">
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
          <ClinicReceivablesTable atendimentos={atendimentos} eAdmin={eAdmin}
            abrirPreviaNfse={abrirPreviaNfse} onPaymentSaved={() => setPeriodo((current) => ({ ...current }))} />

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
      </section>

      {panorama && (
        <p className="text-center text-[10px] text-muted">
          Apurado em {new Intl.DateTimeFormat('pt-BR', {
            dateStyle: 'short',
            timeStyle: 'short',
            timeZone: 'America/Sao_Paulo',
          }).format(new Date(panorama.geradoEm))}
        </p>
      )}

      {/* Ferramentas da Gestão: depois do extrato, que é o que a página responde primeiro. */}
      {eAdmin && <PatientPackagePanel />}
      <EducationalCreditPanel admin={Boolean(eAdmin)} />

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

'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreditCard, FileSpreadsheet } from 'lucide-react';
import { MyReceivablesTable } from '@/components/financial/MyReceivablesTable';
import { financialSessionForEdit, type FinancialData, type Receivable } from '@/lib/myFinancialModel';
import { applicationRequest } from '@/lib/applicationApi';
import { reaisDeCentavos, rotuloFormaPagamento } from '@/lib/modalidadesPagamento';
import { EditSessionModal, type SessionEditableData } from '@/components/scheduling/EditSessionModal';
import { FocoDeNotificacao } from '@/components/layout/FocoDeNotificacao';
import { focoPagamento } from '@/lib/focoNotificacao';

/** O mês corrente como `AAAA-MM`, no fuso em que a clínica atende. */
function mesAtual(): string {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit',
  }).formatToParts(new Date());
  const parte = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((item) => item.type === tipo)?.value ?? '';
  return `${parte('year')}-${parte('month')}`;
}

/**
 * Primeiro e último dia do mês escolhido.
 *
 * A API continua recebendo um intervalo; quem deixou de existir foi a escolha
 * de datas soltas. O extrato do psicólogo é lido por competência — "quanto
 * entrou em agosto" —, e permitir 12/07 a 03/09 só produzia períodos que não
 * fecham com nada. `Date.UTC(ano, mes, 0)` cai no último dia do mês pedido.
 */
function periodoDoMes(mes: string): { start: string; end: string } {
  const [ano, numeroDoMes] = mes.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(ano, numeroDoMes, 0)).getUTCDate();
  return { start: `${mes}-01`, end: `${mes}-${String(ultimoDia).padStart(2, '0')}` };
}

const MES_POR_EXTENSO = new Intl.DateTimeFormat('pt-BR', {
  month: 'long', year: 'numeric', timeZone: 'UTC',
});

export default function MeuFinanceiroPage() {
  const [mes, setMes] = useState(mesAtual);
  const [data, setData] = useState<FinancialData | null>(null);
  const [error, setError] = useState<string>();
  const [editingSession, setEditingSession] = useState<SessionEditableData>();
  const [pacientesMap, setPacientesMap] = useState<Map<string, { conveniado?: boolean; convenioNome?: string }>>(new Map());
  const [linkCopiado, setLinkCopiado] = useState<string>();

  const load = useCallback(() => {
    const { start, end } = periodoDoMes(mes);
    return applicationRequest<FinancialData>(
      `/financial/me?startDate=${start}&endDate=${end}`
    ).then((result) => { setData(result); setError(undefined); })
      .catch((cause) => setError(
        cause instanceof Error ? cause.message : 'Não foi possível carregar o financeiro.'
      ));
  }, [mes]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    applicationRequest<Array<{ id: string; displayName: string; conveniado?: boolean; convenioNome?: string }>>('/patients')
      .then((list) => {
        const map = new Map<string, { conveniado?: boolean; convenioNome?: string }>();
        for (const p of list) {
          map.set(p.id, p);
          if (p.displayName) {
            map.set(p.displayName.trim().toLowerCase(), p);
          }
        }
        setPacientesMap(map);
      })
      .catch(() => {});
  }, []);

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Data', 'Paciente', 'Valor', 'Crédito 70%', 'Método'], ...data.transactions.map((item) => [
      item.receivedAt, item.patientName, (item.amountCents / 100).toFixed(2),
      (item.professionalCreditCents / 100).toFixed(2), rotuloFormaPagamento(item.method),
    ])];
    const blob = new Blob([`\uFEFF${rows.map((row) => row.join(';')).join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const anchor = document.createElement('a');
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `meu-financeiro-${mes}.csv`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  };

  /**
   * Copia o link completo, pronto para colar no WhatsApp do paciente. Sem
   * permissão de área de transferência (navegador antigo, contexto sem HTTPS),
   * o link aparece numa caixa para ser copiado à mão — nunca some em silêncio.
   */
  const copiarLinkPagamento = async (item: Receivable) => {
    if (!item.paymentLink) return;
    const link = new URL(item.paymentLink, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopiado(item.chargeId);
      setTimeout(() => setLinkCopiado((atual) => (atual === item.chargeId ? undefined : atual)), 2000);
    } catch {
      window.prompt('Copie o link de pagamento:', link);
    }
  };


  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/*
        O extrato é lido por competência. O aviso de pagamento traz o mês em
        que ele entrou; sem trocar a competência antes de procurar a linha, o
        clique abriria uma tabela que não contém o pagamento citado.
      */}
      <FocoDeNotificacao
        aoFocar={(_foco, parametros) => {
          const mesPedido = parametros.get('mes');
          if (mesPedido && /^\d{4}-\d{2}$/.test(mesPedido)) setMes(mesPedido);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-ink flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-psi-vibrant" /> Meu Financeiro
          </h1>
          <p className="text-xs text-muted">Valores conciliados pelo Asaas. As cobranças são geradas por agendamento.</p>
        </div>
        <button onClick={exportCsv} disabled={!data} className="rounded-2xl border border-line bg-surface px-4 py-2.5 font-bold flex items-center gap-2 text-xs disabled:opacity-50">
          <FileSpreadsheet className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}

      <section className="bg-surface border border-line rounded-3xl p-5 space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-bold">Mês<input type="month" value={mes} onChange={(e) => setMes(e.target.value || mesAtual())} className="block mt-1 input" /></label>
          <button onClick={() => void load()} className="btn-primary text-xs">Atualizar</button>
          <div className="sm:ml-auto"><p className="text-xs text-muted">Crédito de {MES_POR_EXTENSO.format(new Date(`${mes}-01T12:00:00Z`))} (70%)</p><p className="text-2xl font-black text-emerald-600">{reaisDeCentavos(data?.professionalCreditCents ?? 0)}</p></div>
        </div>
        <div className="overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted border-b border-line"><th className="py-3">Data</th><th>Paciente</th><th>Pagamento</th><th>Crédito 70%</th><th>Forma</th></tr></thead>
          <tbody>{data?.transactions.map((item) => <tr key={item.id} data-foco={focoPagamento(item.id)} className="border-b border-line/70"><td className="py-3">{new Date(item.receivedAt).toLocaleDateString('pt-BR')}</td><td className="font-bold">{item.patientName}</td><td>{reaisDeCentavos(item.amountCents)}</td><td className="text-emerald-700 font-bold">{reaisDeCentavos(item.professionalCreditCents)}</td><td>{rotuloFormaPagamento(item.method)}</td></tr>)}</tbody></table>
          {data?.transactions.length === 0 && <p className="text-center text-muted py-8">Nenhum pagamento conciliado neste mês.</p>}
        </div>
      </section>

      <MyReceivablesTable receivables={data?.receivables} pacientesMap={pacientesMap} linkCopiado={linkCopiado}
        onCopyPayment={copiarLinkPagamento} onEditSession={(item) => setEditingSession(financialSessionForEdit(item))} />

      {editingSession && (
        <EditSessionModal
          session={editingSession}
          isOpen={Boolean(editingSession)}
          onClose={() => setEditingSession(undefined)}
          onSaved={load}
        />
      )}
    </div>
  );
}

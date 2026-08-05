import { FinancialReportBundle } from '@thats-life/core';
import { people } from '@/components/financial/demoLedger';

const money = (cents: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);

const date = (val?: string) =>
  val ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(val)) : '-';

export function exportBrandedFinancialPdf(report: FinancialReportBundle) {
  const { summary, receivables } = report;

  // Pacientes e seus totais acumulados
  const patientTotals: Record<string, { name: string; totalCents: number; count: number }> = {};
  receivables.forEach((r) => {
    const name = people.patients[r.patientId as keyof typeof people.patients] ?? r.patientId;
    if (!patientTotals[r.patientId]) {
      patientTotals[r.patientId] = { name, totalCents: 0, count: 0 };
    }
    patientTotals[r.patientId].totalCents += r.netAmountCents;
    patientTotals[r.patientId].count += 1;
  });

  const patientBreakdown = Object.values(patientTotals).sort((a, b) => b.totalCents - a.totalCents);

  const htmlContent = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório Financeiro — Thats Life Psi</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: #F9F5FC;
      color: #1E1528;
      padding: 32px;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .wrapper { max-width: 900px; margin: 0 auto; background: #ffffff; border-radius: 20px; box-shadow: 0 10px 30px rgba(67, 38, 94, 0.08); padding: 40px; }
    .header {
      background: linear-gradient(135deg, #43265E 0%, #5C397D 100%);
      color: #ffffff;
      padding: 32px;
      border-radius: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 28px;
    }
    .brand { font-size: 22px; font-weight: 900; letter-spacing: -0.5px; }
    .brand span { background: #9E6BCF; color: #43265E; padding: 2px 8px; border-radius: 6px; font-size: 14px; margin-left: 6px; }
    .subtitle { font-size: 12px; color: #EDE6F4; opacity: 0.85; margin-top: 4px; }
    .badge-date { background: rgba(255,255,255,0.15); padding: 8px 14px; border-radius: 10px; font-size: 11px; font-weight: 600; text-align: right; }
    
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px; }
    .card { background: #F9F5FC; border: 1px solid #EDE6F4; border-radius: 14px; padding: 16px; text-align: left; }
    .card-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #756785; letter-spacing: 0.5px; }
    .card-value { font-size: 18px; font-weight: 900; color: #43265E; margin-top: 6px; }
    .card-sub { font-size: 10px; color: #756785; margin-top: 2px; }

    .section-title { font-size: 16px; font-weight: 800; color: #43265E; margin-bottom: 14px; border-bottom: 2px solid #EDE6F4; padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 11px; }
    th { background: #43265E; color: #ffffff; text-transform: uppercase; font-size: 9px; font-weight: 800; letter-spacing: 0.8px; padding: 10px 12px; text-align: left; }
    th:first-child { border-top-left-radius: 8px; }
    th:last-child { border-top-right-radius: 8px; text-align: right; }
    td { padding: 11px 12px; border-bottom: 1px solid #F0E9F5; }
    tr:nth-child(even) { background: #FAF7FC; }

    .status { padding: 3px 8px; border-radius: 12px; font-weight: 700; font-size: 10px; display: inline-block; }
    .status-paid { background: #DEF7EC; color: #03543F; }
    .status-pending { background: #E1EFFE; color: #1E429F; }
    .status-overdue { background: #FDE8E8; color: #9B1C1C; }
    .status-partial { background: #FEF08A; color: #713F12; }

    .breakdown-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 28px; }

    .footer { border-t: 1px solid #EDE6F4; padding-top: 18px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #756785; }
    @media print {
      body { background: #ffffff; padding: 0; }
      .wrapper { box-shadow: none; border-radius: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div>
        <div class="brand">Thats Life <span>Psi</span></div>
        <div class="subtitle">Relatório Executivo & DRE de Inteligência Financeira</div>
      </div>
      <div class="badge-date">
        <div>Emissão: ${date(summary.generatedAt)}</div>
        <div>Período: Julho 2026</div>
      </div>
    </div>

    <!-- Cards de Resumo -->
    <div class="grid">
      <div class="card">
        <div class="card-title">Faturamento Bruto</div>
        <div class="card-value">${money(summary.grossBilledCents)}</div>
        <div class="card-sub">${summary.chargeCount} cobrança(s) gerada(s)</div>
      </div>
      <div class="card">
        <div class="card-title">Recebido em Caixa</div>
        <div class="card-value" style="color: #059669;">${money(summary.receivedCents)}</div>
        <div class="card-sub">${summary.settledChargeCount} sessão(ões) liquidadas</div>
      </div>
      <div class="card">
        <div class="card-title">Valores em Aberto</div>
        <div class="card-value" style="color: #D97706;">${money(summary.outstandingCents)}</div>
        <div class="card-sub">Pendente no período</div>
      </div>
      <div class="card">
        <div class="card-title">Inadimplência</div>
        <div class="card-value" style="color: #DC2626;">${(summary.delinquencyRate * 100).toFixed(1)}%</div>
        <div class="card-sub">Vencido: ${money(summary.overdueCents)}</div>
      </div>
    </div>

    <!-- Detalhamento por Paciente & Repasses -->
    <div class="breakdown-grid">
      <div>
        <div class="section-title">Faturamento por Paciente</div>
        <table>
          <thead>
            <tr>
              <th>Paciente</th>
              <th>Sessões</th>
              <th style="text-align: right;">Total Líquido</th>
            </tr>
          </thead>
          <tbody>
            ${patientBreakdown
              .map(
                (p) => `
              <tr>
                <td><strong>${p.name}</strong></td>
                <td>${p.count} atendimento(s)</td>
                <td style="text-align: right; font-weight: 700; color: #5C397D;">${money(p.totalCents)}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      <div>
        <div class="section-title">Resumo Operacional & Deduções</div>
        <table>
          <thead>
            <tr>
              <th>Categoria Operacional</th>
              <th style="text-align: right;">Valor</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Descontos Sociais Concedidos</td>
              <td style="text-align: right; font-weight: 600;">${money(summary.discountsCents)}</td>
            </tr>
            <tr>
              <td>Taxas de Processamento Pix (Gateway)</td>
              <td style="text-align: right; font-weight: 600;">${money(summary.feesCents)}</td>
            </tr>
            <tr>
              <td>Repasses a Profissionais Pagos</td>
              <td style="text-align: right; font-weight: 600;">${money(summary.transfersPaidCents)}</td>
            </tr>
            <tr>
              <td><strong>Resultado Operacional Líquido</strong></td>
              <td style="text-align: right; font-weight: 900; color: #059669;">${money(summary.netCashCents)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Contas a Receber -->
    <div class="section-title">Detalhamento de Contas a Receber (Sessão por Sessão)</div>
    <table>
      <thead>
        <tr>
          <th>Paciente / Sessão</th>
          <th>Profissional</th>
          <th>Vencimento</th>
          <th>Status</th>
          <th>Valor Líquido</th>
          <th style="text-align: right;">Em Aberto</th>
        </tr>
      </thead>
      <tbody>
        ${receivables
          .map((r) => {
            const patientName = people.patients[r.patientId as keyof typeof people.patients] ?? r.patientId;
            const profName = people.professionals[r.professionalId as keyof typeof people.professionals] ?? r.professionalId;
            const statusClass =
              r.chargeStatus === 'paid'
                ? 'status-paid'
                : r.chargeStatus === 'pending'
                ? 'status-pending'
                : r.chargeStatus === 'overdue'
                ? 'status-overdue'
                : 'status-partial';
            const statusLabel =
              r.chargeStatus === 'paid'
                ? 'Pago'
                : r.chargeStatus === 'pending'
                ? 'Pendente'
                : r.chargeStatus === 'overdue'
                ? 'Vencido'
                : 'Parcial';

            return `
            <tr>
              <td><strong>${patientName}</strong><br/><span style="color:#756785; font-size:9px;">${r.sessionId}</span></td>
              <td>${profName}</td>
              <td>${date(r.dueAt)}</td>
              <td><span class="status ${statusClass}">${statusLabel}</span></td>
              <td style="font-weight: 600;">${money(r.netAmountCents)}</td>
              <td style="text-align: right; font-weight: 700; color: ${r.outstandingAmountCents > 0 ? '#DC2626' : '#059669'};">
                ${money(r.outstandingAmountCents)}
              </td>
            </tr>
          `;
          })
          .join('')}
      </tbody>
    </table>

    <div class="footer">
      <div>Documento Gerencial emitido via <strong>Thats Life Psi Engine</strong> — Resolução CFP N.º 01/2009</div>
      <div>Página 1 de 1</div>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;

  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}

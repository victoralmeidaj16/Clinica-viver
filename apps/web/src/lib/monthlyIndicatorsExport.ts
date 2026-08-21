import type { DistributionItem, MonthlyIndicators } from './monthlyIndicators';

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function distribution(items: DistributionItem[]): string {
  const populated = items.filter((item) => item.quantidade > 0);
  if (populated.length === 0) return 'Sem dados';
  return populated.map((item) => `${escapeHtml(item.label)}: ${item.quantidade} (${item.percentual}%)`).join(' · ');
}

function variation(value: number | null): string {
  if (value === null) return 'Sem base no mês anterior';
  return `${value > 0 ? '+' : ''}${value}% em relação ao mês anterior`;
}

export function openMonthlyIndicatorsReport(data: MonthlyIndicators, generatedAt: string): void {
  const cards = [
    ['1. Fila atual de leads', `${data.filaAtual.total} aguardando`, `${data.filaAtual.alocados} alocados · ${data.filaAtual.semProfissional} sem profissional`],
    ['2. SLA de 24 horas', data.sla24h.percentual === null ? 'Sem casos avaliáveis' : `${data.sla24h.percentual}% cumprido`, `${data.sla24h.cumpridos} cumpridos · ${data.sla24h.violados} violações · ${data.sla24h.emAndamento} em andamento`],
    ['3. Gênero dos novos leads', distribution(data.leadsDoMes.genero), `Amostra: ${data.leadsDoMes.total} leads`],
    ['4. Faixa etária dos novos leads', distribution(data.leadsDoMes.faixaEtaria), `Amostra: ${data.leadsDoMes.total} leads`],
    ['5. Origem dos novos leads', distribution(data.leadsDoMes.origens), `Amostra: ${data.leadsDoMes.total} leads`],
    ['6. Número de sessões / atendimentos', `${data.sessoes.total} sessões registradas`, `${data.sessoes.realizadas} atendimentos realizados · ${data.sessoes.agendadas} agendadas · ${data.sessoes.confirmadas} confirmadas · ${data.sessoes.emAndamento} em andamento · ${data.sessoes.canceladas} canceladas · ${data.sessoes.faltas} faltas · ${variation(data.sessoes.variacaoRealizadasPercentual)}`],
    ['7. Modalidades dos novos leads', distribution(data.leadsDoMes.modalidades), `Amostra: ${data.leadsDoMes.total} leads`],
    ...data.indisponiveis.map((item, index) => [`${index + 8}. ${item.titulo}`, 'Dados ainda não configurados', item.motivo]),
    ['11. Eventos de auditoria', `${data.auditoria.total} eventos`, `${data.auditoria.acessosConcedidos} concedidos · ${data.auditoria.acessosNegados} negados`],
  ];
  const start = new Date(data.periodo.inicio).toLocaleDateString('pt-BR', { timeZone: data.periodo.timezone });
  const endDate = new Date(new Date(data.periodo.fimExclusivo).getTime() - 1);
  const end = endDate.toLocaleDateString('pt-BR', { timeZone: data.periodo.timezone });
  const firstAudit = data.auditoria.primeiroEventoEm
    ? new Date(data.auditoria.primeiroEventoEm).toLocaleString('pt-BR', { timeZone: data.periodo.timezone })
    : 'Nenhum evento disponível';

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Indicadores ${escapeHtml(data.competencia)}</title>
<style>
*{box-sizing:border-box}body{font-family:Arial,sans-serif;background:#f8f5fb;color:#24182e;margin:0;padding:28px}.header{background:#43265e;color:#fff;border-radius:18px;padding:26px;margin-bottom:18px}.header h1{margin:0 0 6px;font-size:24px}.header p{margin:3px 0;color:#ede6f4;font-size:12px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{background:#fff;border:1px solid #e4dbea;border-radius:14px;padding:16px;break-inside:avoid}.card h2{color:#756785;font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin:0 0 8px}.value{font-size:18px;font-weight:800;color:#43265e}.detail{font-size:11px;color:#6e6378;margin-top:5px;line-height:1.45}.notice{margin-top:16px;padding:13px;border-radius:12px;background:#fff8e6;border:1px solid #f2d594;font-size:11px}.footer{margin-top:18px;text-align:center;color:#756785;font-size:10px}@media print{body{padding:0}.header{border-radius:0}.card{box-shadow:none}}
</style></head><body>
<section class="header"><h1>Indicadores mensais — Viver Mais Psicologia</h1><p>Competência ${escapeHtml(data.competencia)} · ${start} a ${end}</p><p>Gerado em ${new Date(generatedAt).toLocaleString('pt-BR', { timeZone: data.periodo.timezone })} · Fuso ${data.periodo.timezone}</p></section>
<main class="grid">${cards.map(([title, value, detail]) => `<article class="card"><h2>${escapeHtml(title)}</h2><div class="value">${escapeHtml(value)}</div><div class="detail">${escapeHtml(detail)}</div></article>`).join('')}</main>
<aside class="notice">O histórico de auditoria anterior à correção pode estar incompleto. Primeiro evento disponível: ${escapeHtml(firstAudit)}.</aside>
<div class="footer">Relatório gerado com os mesmos dados exibidos na plataforma.</div>
<script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`;
  const target = window.open('', '_blank');
  if (!target) return;
  target.document.write(html);
  target.document.close();
}

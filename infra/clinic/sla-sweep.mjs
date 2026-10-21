/**
 * Relógio resiliente do transbordo de triagem.
 *
 * Mantido como processo separado do Next.js para que reinícios, deploys e
 * ausência de acesso ao cockpit não parem o SLA. O endpoint continua sendo a
 * única porta de mutação e preserva a idempotência do rodízio.
 */
const url = process.env.SLA_SWEEP_URL?.trim() || 'http://web:3000/api/application/triagem/sla-sweep';
// Mesmo relógio libera as confirmações de agendamento que esperavam o
// horário comercial. Fora do expediente a rota não faz nada.
const agendaUrl = process.env.AGENDA_AVISOS_URL?.trim() || 'http://web:3000/api/application/agenda/avisos/liberar';
const token = process.env.SLA_SWEEP_TOKEN?.trim();
const seconds = Number.parseInt(process.env.SLA_SWEEP_INTERVAL_SECONDS ?? '300', 10);
const intervalMs = Math.max(60, Number.isFinite(seconds) ? seconds : 300) * 1_000;

if (!token) {
  console.error('SLA_SWEEP_TOKEN não configurado; worker de SLA não será iniciado.');
  process.exit(1);
}

async function sweep() {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'x-sla-token': token, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      console.error(`Varredura de SLA recusada: HTTP ${response.status}.`);
      return;
    }
    const body = await response.json().catch(() => null);
    console.info(`Varredura de SLA concluída; transbordos=${Number(body?.transbordosExecutados ?? 0)}.`);
  } catch (error) {
    console.error('Falha na varredura de SLA; nova tentativa no próximo ciclo.', error instanceof Error ? error.message : error);
  }
}

async function liberarAvisosAgenda() {
  try {
    const response = await fetch(agendaUrl, {
      method: 'POST',
      headers: { 'x-sla-token': token, 'content-type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(120_000),
    });
    if (!response.ok) {
      console.error(`Liberação de avisos da agenda recusada: HTTP ${response.status}.`);
      return;
    }
    const body = await response.json().catch(() => null);
    const enviados = Number(body?.enviados ?? 0);
    const descartados = Number(body?.descartados ?? 0);
    if (enviados || descartados) {
      console.info(`Avisos da agenda liberados; enviados=${enviados} descartados=${descartados}.`);
    }
  } catch (error) {
    console.error('Falha ao liberar avisos da agenda; nova tentativa no próximo ciclo.', error instanceof Error ? error.message : error);
  }
}

async function ciclo() {
  await sweep();
  await liberarAvisosAgenda();
}

await ciclo();
setInterval(ciclo, intervalMs);

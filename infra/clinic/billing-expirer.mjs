/** Relógio de vencimento exato das cobranças, isolado do processo Next.js. */
const url = process.env.BILLING_EXPIRY_URL?.trim()
  || 'http://web:3000/api/application/financial/charges/expire';
const token = process.env.BILLING_EXPIRY_TOKEN?.trim();
const seconds = Number.parseInt(process.env.BILLING_EXPIRY_INTERVAL_SECONDS ?? '60', 10);
const intervalMs = Math.max(60, Number.isFinite(seconds) ? seconds : 60) * 1_000;

if (!token) {
  console.error('BILLING_EXPIRY_TOKEN não configurado; worker financeiro não será iniciado.');
  process.exit(1);
}

async function sweep() {
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'x-billing-expiry-token': token },
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) { console.error(`Varredura financeira recusada: HTTP ${response.status}.`); return; }
    const body = await response.json().catch(() => null);
    console.info(`Varredura financeira concluída; expiradas=${Number(body?.expired ?? 0)}, falhas=${Number(body?.failed ?? 0)}.`);
  } catch (error) {
    console.error('Falha na varredura financeira; nova tentativa no próximo ciclo.', error instanceof Error ? error.message : error);
  }
}

await sweep();
setInterval(sweep, intervalMs);

/**
 * Chamada às rotas da Gestão, que respondem `{ success, data, error }`.
 * Lança com a mensagem da rota — é ela que diz o que fazer.
 */
export async function chamarGestao<T = unknown>(
  url: string,
  corpo?: Record<string, unknown>,
  metodo: 'GET' | 'POST' | 'PUT' = corpo ? 'POST' : 'GET',
): Promise<T> {
  const resposta = await fetch(url, {
    method: metodo,
    cache: 'no-store',
    headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const json = await resposta.json().catch(() => null) as { success?: boolean; data?: T; error?: string; code?: string } | null;
  if (!resposta.ok || !json?.success) {
    const erro = new Error(json?.error ?? `Falha na operação (HTTP ${resposta.status}).`) as Error & { code?: string };
    erro.code = json?.code;
    throw erro;
  }
  return json.data as T;
}

/** Data e hora no fuso da clínica. */
export function dataHoraBr(iso?: string): string {
  if (!iso) return '—';
  const instante = Date.parse(iso);
  return Number.isFinite(instante)
    ? new Date(instante).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—';
}

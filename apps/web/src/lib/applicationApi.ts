interface ApiEnvelope<T> { ok: boolean; data?: T; error?: { code: string; message: string }; }

export async function applicationRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/application${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Erro de conexão com o servidor (${response.status}). Tente novamente em instantes.`);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new Error('Resposta inválida do servidor.');
  }

  if (!response.ok || !envelope.ok || envelope.data === undefined) throw new Error(envelope.error?.message ?? 'Não foi possível concluir a operação.');
  return envelope.data;
}

export function commandHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID(), 'X-Correlation-Id': crypto.randomUUID() };
}

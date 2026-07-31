const demoHeaders = {
  'X-Organization-Id': 'org-demo',
  'X-User-Id': 'user-demo',
};

interface ApiEnvelope<T> { ok: boolean; data?: T; error?: { code: string; message: string }; }

export async function applicationRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/application${path}`, {
    ...init,
    cache: 'no-store',
    headers: { ...demoHeaders, ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
  });
  const envelope = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !envelope.ok || envelope.data === undefined) throw new Error(envelope.error?.message ?? 'Não foi possível concluir a operação.');
  return envelope.data;
}

export function commandHeaders() {
  return { 'Idempotency-Key': crypto.randomUUID(), 'X-Correlation-Id': crypto.randomUUID() };
}

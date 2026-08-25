import 'server-only';

/**
 * Route Handlers locais têm precedência sobre rewrites do Next.js. Na Vercel,
 * essas APIs precisam encaminhar explicitamente a requisição para a VPS, onde
 * o MySQL privado está disponível. Na VPS, o handler continua normalmente.
 */
export async function proxyToPersistentBackend(request: Request): Promise<Response | null> {
  if (!process.env.VERCEL) return null;

  const backendOrigin =
    process.env.BACKEND_ORIGIN?.trim().replace(/\/$/, '') ||
    'https://app.clinicavivermais.cloud';
  const incomingUrl = new URL(request.url);
  const destination = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendOrigin);
  const headers = new Headers(request.headers);

  headers.delete('host');
  headers.delete('content-length');
  headers.set('x-forwarded-host', incomingUrl.host);
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));

  const response = await fetch(destination, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD'
      ? undefined
      : await request.arrayBuffer(),
    cache: 'no-store',
    redirect: 'manual',
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

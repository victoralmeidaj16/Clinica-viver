import { NextResponse } from 'next/server';
import { ociRuntimeHealth } from '@/server/oci/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Diagnóstico de infraestrutura. Separado de `/api/application/status`, que
 * responde sobre o estado da aplicação para um usuário autenticado — este
 * responde sobre os serviços, e é consumido por healthcheck e deploy.
 *
 * Exige `CRON_SECRET` e informa apenas estados. Nada de endpoint, credencial
 * ou mensagem do driver na resposta: um diagnóstico aberto é um mapa da rede.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET não configurado.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  }

  const services = await ociRuntimeHealth();
  const ready = services.mysql === 'ok';

  return NextResponse.json(
    { ready, services, version: process.env.APP_VERSION ?? 'unknown' },
    { status: ready ? 200 : 503 }
  );
}

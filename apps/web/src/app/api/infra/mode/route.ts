import { NextResponse } from 'next/server';
import { isMysqlConfigured } from '@/server/oci/runtime';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Modo de persistência da instalação.
 *
 * Público de propósito, e por isso responde uma palavra só: se os dados estão
 * num banco ou em memória. Não informa endpoint, versão nem saúde — para isso
 * existe uma rota protegida de diagnóstico de infraestrutura, que exige
 * `CRON_SECRET` (o caminho atual mantém o nome legado `oci`).
 *
 * Quem consome é o aviso de demonstração no layout: um banner que diz "dados
 * simulados" sobre uma clínica em produção é pior do que banner nenhum.
 */
export async function GET() {
  return NextResponse.json(
    { persistence: isMysqlConfigured() ? 'mysql' : 'memory' },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

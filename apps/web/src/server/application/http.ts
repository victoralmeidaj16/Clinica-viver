import { NextResponse } from 'next/server';
import { isMysqlConfigured } from '@/server/oci/runtime';

export class ApplicationError extends Error {
  constructor(public readonly code: string, message: string, public readonly status: number) { super(message); }
}

export function success<T>(data: T, status = 200) {
  // `persistence` é o que distingue uma resposta apoiada no banco de uma
  // resposta de demonstração. Mantê-lo fixo em 'memory' tornaria impossível,
  // do lado do cliente, saber se o dado sobrevive ao próximo restart.
  const persistence = isMysqlConfigured() ? 'mysql' : 'memory';
  return NextResponse.json({ ok: true, data, meta: { generatedAt: new Date().toISOString(), persistence } }, { status, headers: { 'Cache-Control': 'no-store' } });
}

/**
 * Falha de infraestrutura: erro do driver do MySQL ou do sistema (rede, disco).
 *
 * As regras de negócio lançam `Error` simples com texto feito para a tela, e
 * por isso o padrão é repassar a mensagem. Estes aqui carregam `errno`, que
 * nenhum erro de regra tem — e a mensagem deles é SQL, nome de tabela e host.
 */
function falhaDeInfraestrutura(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || error instanceof ApplicationError) return false;
  const detalhe = error as { errno?: unknown; sqlState?: unknown; sqlMessage?: unknown };
  return typeof detalhe.errno === 'number' || typeof detalhe.sqlState === 'string' || typeof detalhe.sqlMessage === 'string';
}

export function failure(error: unknown) {
  if (falhaDeInfraestrutura(error)) {
    console.error('[api] Falha de infraestrutura ao atender a requisição.');
    return NextResponse.json(
      { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Não foi possível concluir a operação agora. Tente novamente em instantes.' } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }
  const message = error instanceof Error ? error.message : 'Erro interno.';
  const known = error instanceof ApplicationError
    ? error
    : message.includes('Acesso negado')
      ? new ApplicationError('FORBIDDEN', message, 403)
      : message.toLocaleLowerCase('pt-BR').includes('não encontrad')
        ? new ApplicationError('NOT_FOUND', message, 404)
        : message.toLocaleLowerCase('pt-BR').includes('conflito') || message.includes('já possui')
          ? new ApplicationError('CONFLICT', message, 409)
          : new ApplicationError('DOMAIN_ERROR', message, 400);
  return NextResponse.json({ ok: false, error: { code: known.code, message: known.message } }, { status: known.status, headers: { 'Cache-Control': 'no-store' } });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try { return await request.json() as Record<string, unknown>; }
  catch { throw new ApplicationError('INVALID_JSON', 'O corpo da requisição deve ser JSON válido.', 400); }
}

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

export function failure(error: unknown) {
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

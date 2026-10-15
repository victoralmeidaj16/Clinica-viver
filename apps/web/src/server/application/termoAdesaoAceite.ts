import 'server-only';

import { createHash } from 'node:crypto';
import {
  TERMO_ADESAO_CLAUSULAS,
  TERMO_ADESAO_HONORARIOS,
  TERMO_ADESAO_IDENTIFICACAO,
  TERMO_ADESAO_TITULO,
  VERSAO_TERMO_ADESAO,
} from '@/components/forms/termoAdesaoContent';
import type { AceiteTermoAdesao } from '@/server/application/persistence';

/**
 * Forma canônica do texto do termo, a mesma que o modal exibe.
 *
 * Para conferir uma prova depois, basta recalcular o SHA-256 deste JSON a
 * partir de `termoAdesaoContent.ts` na versão do repositório em que o termo
 * tinha a `versao` registrada. Qualquer mudança de vírgula muda o hash — por
 * isso uma edição do texto exige subir `VERSAO_TERMO_ADESAO`.
 */
export function textoCanonicoTermoAdesao(): string {
  return JSON.stringify({
    titulo: TERMO_ADESAO_TITULO,
    versao: VERSAO_TERMO_ADESAO,
    identificacao: TERMO_ADESAO_IDENTIFICACAO,
    clausulas: TERMO_ADESAO_CLAUSULAS,
    honorarios: TERMO_ADESAO_HONORARIOS,
  });
}

export function hashTermoAdesao(): string {
  return createHash('sha256').update(textoCanonicoTermoAdesao(), 'utf8').digest('hex');
}

function limitar(valor: string | null, maximo: number): string | undefined {
  const limpo = valor?.trim();
  return limpo ? limpo.slice(0, maximo) : undefined;
}

/**
 * IP de quem enviou. A página chega aqui pela Vercel, que reescreve
 * `/api/application/*` para a VPS: o primeiro item de `x-forwarded-for` é o
 * cliente, enquanto `x-real-ip` pode ser o proxy da própria VPS. A cadeia bruta
 * fica guardada junto para quem precisar auditar a derivação.
 */
function ipDoCliente(request: Request): { ip?: string; cadeiaIp?: string } {
  const vercel = request.headers.get('x-vercel-forwarded-for');
  const encaminhado = request.headers.get('x-forwarded-for');
  const real = request.headers.get('x-real-ip');
  const ip = limitar(vercel?.split(',')[0] ?? null, 64)
    ?? limitar(encaminhado?.split(',')[0] ?? null, 64)
    ?? limitar(real, 64);
  const cadeia = [
    vercel && `x-vercel-forwarded-for=${vercel}`,
    encaminhado && `x-forwarded-for=${encaminhado}`,
    real && `x-real-ip=${real}`,
  ].filter(Boolean).join('; ');
  return { ip, cadeiaIp: limitar(cadeia, 500) };
}

export function registrarAceiteTermoAdesao(
  request: Request,
  versaoExibida: unknown,
  agora: Date = new Date()
): AceiteTermoAdesao {
  const versao = limitar(typeof versaoExibida === 'string' ? versaoExibida : null, 32) ?? 'nao-informada';
  return {
    versao,
    aceitoEm: agora.toISOString(),
    ...ipDoCliente(request),
    navegador: limitar(request.headers.get('user-agent'), 500),
    hashAlgoritmo: 'SHA-256',
    hashTexto: versao === VERSAO_TERMO_ADESAO ? hashTermoAdesao() : undefined,
  };
}

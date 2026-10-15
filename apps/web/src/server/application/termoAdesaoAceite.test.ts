import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { VERSAO_TERMO_ADESAO } from '@/components/forms/termoAdesaoContent';
import {
  hashTermoAdesao,
  registrarAceiteTermoAdesao,
  textoCanonicoTermoAdesao,
} from './termoAdesaoAceite';

function requisicao(headers: Record<string, string>) {
  return new Request('https://app.clinicavivermais.cloud/api/application/credenciamento-psicologo', {
    method: 'POST',
    headers,
  });
}

describe('prova do aceite do Termo de Adesão', () => {
  it('calcula o SHA-256 sobre o texto canônico da versão vigente', () => {
    const esperado = createHash('sha256').update(textoCanonicoTermoAdesao(), 'utf8').digest('hex');
    expect(hashTermoAdesao()).toBe(esperado);
    expect(hashTermoAdesao()).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(textoCanonicoTermoAdesao()).versao).toBe(VERSAO_TERMO_ADESAO);
  });

  it('usa a hora do servidor e o IP do cliente, não o do proxy', () => {
    const agora = new Date('2026-10-15T17:32:10.000Z');
    const aceite = registrarAceiteTermoAdesao(
      requisicao({
        'x-forwarded-for': '203.0.113.7, 76.76.21.21',
        'x-real-ip': '76.76.21.21',
        'user-agent': 'Mozilla/5.0 (Macintosh) Safari/605.1.15',
      }),
      VERSAO_TERMO_ADESAO,
      agora
    );

    expect(aceite).toEqual({
      versao: VERSAO_TERMO_ADESAO,
      aceitoEm: '2026-10-15T17:32:10.000Z',
      ip: '203.0.113.7',
      cadeiaIp: 'x-forwarded-for=203.0.113.7, 76.76.21.21; x-real-ip=76.76.21.21',
      navegador: 'Mozilla/5.0 (Macintosh) Safari/605.1.15',
      hashAlgoritmo: 'SHA-256',
      hashTexto: hashTermoAdesao(),
    });
  });

  it('prefere o cabeçalho da Vercel quando ele existe', () => {
    const aceite = registrarAceiteTermoAdesao(
      requisicao({ 'x-vercel-forwarded-for': '198.51.100.20', 'x-forwarded-for': '10.0.0.1' }),
      VERSAO_TERMO_ADESAO
    );
    expect(aceite.ip).toBe('198.51.100.20');
  });

  it('não registra hash quando o formulário exibiu outra versão do termo', () => {
    const aceite = registrarAceiteTermoAdesao(requisicao({}), '2026.1');
    expect(aceite.versao).toBe('2026.1');
    expect(aceite.hashTexto).toBeUndefined();
    expect(aceite.ip).toBeUndefined();
  });

  it('marca a versão como não informada quando o navegador não a envia', () => {
    expect(registrarAceiteTermoAdesao(requisicao({}), undefined).versao).toBe('nao-informada');
  });
});

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  COMANDO_CONFIRMAR,
  COMANDO_CONTATO,
  COMANDO_ENCAMINHAR,
  interpretarComando,
} from './viverMaisComandos';

describe('interpretação de comandos do psicólogo via WhatsApp', () => {
  it('exporta as constantes canônicas de comando', () => {
    expect(COMANDO_CONFIRMAR).toBe('CONFIRMAR');
    expect(COMANDO_CONTATO).toBe('CONFIRMAR');
    expect(COMANDO_ENCAMINHAR).toBe('ENCAMINHAR');
  });

  it.each([
    ['CONFIRMAR'],
    ['confirmar'],
    ['Confirmar'],
    ['CONFIRMA'],
    ['confirma'],
    ['CONFIRMADO'],
    ['confirmado'],
    ['CONFIRMEI'],
    ['confirmei'],
    ['Ok, confirmar contato!'],
    ['já fiz o contato, confirmar'],
    ['CONTATO'],
    ['contato'],
    ['Contato'],
    ['contatei'],
    ['Fiz contato'],
  ])('reconhece confirmação em "%s"', (texto) => {
    expect(interpretarComando(texto)).toBe('CONFIRMAR');
  });

  it.each([
    ['ENCAMINHAR'],
    ['encaminhar'],
    ['Encaminhar'],
    ['ENCAMINHA'],
    ['encaminha'],
    ['pode encaminhar para outro'],
    ['não posso atender, favor encaminhar'],
  ])('reconhece encaminhamento em "%s"', (texto) => {
    expect(interpretarComando(texto)).toBe('ENCAMINHAR');
  });

  it('rejeita mensagens ambíguas que contêm ambos os comandos', () => {
    expect(interpretarComando('confirmar ou encaminhar?')).toBeNull();
    expect(interpretarComando('contato feito, mas pode encaminhar')).toBeNull();
  });

  it.each([
    [''],
    ['   '],
    ['olá, bom dia'],
    ['qual o valor?'],
    ['não entendi'],
    ['12345'],
  ])('retorna null para textos não reconhecidos ("%s")', (texto) => {
    expect(interpretarComando(texto)).toBeNull();
  });
});

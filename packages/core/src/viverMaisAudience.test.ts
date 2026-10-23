import { describe, expect, it } from 'vitest';
import {
  normalizarPublicoAlvo,
  publicoAlvoCompativel,
  publicosCompativeisComSolicitacao,
} from './viverMaisAudience';

describe('compatibilidade de públicos da Viver Mais', () => {
  it('traduz os rótulos públicos da vitrine para o cadastro profissional', () => {
    expect(publicosCompativeisComSolicitacao('Individual')).toEqual(['homem', 'mulher', 'idoso']);
    expect(publicosCompativeisComSolicitacao('Infantil')).toEqual(['crianca']);
    expect(publicosCompativeisComSolicitacao('Casal')).toEqual(['casal']);
    expect(publicosCompativeisComSolicitacao('Outro: gestante')).toEqual(['outro']);
  });

  it('normaliza acentos, gênero e plural dos rótulos cadastrados', () => {
    expect(normalizarPublicoAlvo(' Crianças ')).toBe('crianca');
    expect(normalizarPublicoAlvo('Homens')).toBe('homem');
    expect(normalizarPublicoAlvo('Mulheres')).toBe('mulher');
    expect(normalizarPublicoAlvo('Idosas')).toBe('idoso');
    expect(normalizarPublicoAlvo('Famílias')).toBe('familia');
  });

  it('aceita somente públicos profissionais compatíveis com a solicitação', () => {
    expect(publicoAlvoCompativel(['Homens'], 'Individual')).toBe(true);
    expect(publicoAlvoCompativel(['Mulheres'], 'Individual')).toBe(true);
    expect(publicoAlvoCompativel(['Idoso'], 'Individual')).toBe(true);
    expect(publicoAlvoCompativel(['Criança'], 'Infantil')).toBe(true);
    expect(publicoAlvoCompativel(['Casais'], 'Individual')).toBe(false);
    expect(publicoAlvoCompativel(['Família'], 'Individual')).toBe(false);
    expect(publicoAlvoCompativel(['Adolescente'], 'Individual')).toBe(false);
  });

  it('preserva perfis legados e solicitações sem público', () => {
    expect(publicoAlvoCompativel(undefined, 'Individual')).toBe(true);
    expect(publicoAlvoCompativel([], 'Infantil')).toBe(true);
    expect(publicoAlvoCompativel(['Casais'], undefined)).toBe(true);
    expect(publicoAlvoCompativel(['Casais'], '')).toBe(true);
  });
});

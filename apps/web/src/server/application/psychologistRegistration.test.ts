import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import type { CadastroPsicologoRecord } from './persistence';
import { aplicarMudancas, CAMPOS_DA_GESTAO, derivarModalidadesAtendidas } from './psychologistRegistration';

const cadastro = (mudancas: Partial<CadastroPsicologoRecord> = {}): CadastroPsicologoRecord => ({
  id: 'psi-1',
  nomeCompleto: 'Joliana Souza',
  crp: '12/29788',
  whatsapp: '5548999999999',
  status: 'APROVADO',
  criadoEm: '2026-08-26T12:00:00.000Z',
  pausadoNoRodizio: false,
  exibirNaVitrine: true,
  ...mudancas,
});

describe('estado operacional do psicólogo', () => {
  it('retira da vitrine ao pausar o rodízio', () => {
    const resultado = aplicarMudancas(
      cadastro(),
      { pausadoNoRodizio: true, motivoPausaRodizio: 'Férias' },
      CAMPOS_DA_GESTAO
    );

    expect(resultado.pausadoNoRodizio).toBe(true);
    expect(resultado.exibirNaVitrine).toBe(false);
  });

  it('devolve à vitrine ao retomar o rodízio', () => {
    const resultado = aplicarMudancas(
      cadastro({ pausadoNoRodizio: true, exibirNaVitrine: false }),
      { pausadoNoRodizio: false },
      CAMPOS_DA_GESTAO
    );

    expect(resultado.pausadoNoRodizio).toBe(false);
    expect(resultado.exibirNaVitrine).toBe(true);
    expect(resultado.motivoPausaRodizio).toBeUndefined();
    expect(resultado.motivoDesativacao).toBeUndefined();
  });

  it('converte o comando legado de ocultar em pausa', () => {
    const resultado = aplicarMudancas(
      cadastro(),
      { exibirNaVitrine: false },
      CAMPOS_DA_GESTAO
    );

    expect(resultado.pausadoNoRodizio).toBe(true);
    expect(resultado.exibirNaVitrine).toBe(false);
  });

  it('deriva modalidades com equivalência social e acessível', () => {
    expect(derivarModalidadesAtendidas('SOCIAL')).toContain('ACESSIVEL_SOCIAL');
    expect(derivarModalidadesAtendidas('SOCIAL')).toContain('SOCIAL');
    expect(derivarModalidadesAtendidas('PARTICULAR')).toEqual(['PARTICULAR']);
    expect(derivarModalidadesAtendidas('AMBOS')).toContain('ACESSIVEL_SOCIAL');
    expect(derivarModalidadesAtendidas('AMBOS')).toContain('PARTICULAR');
  });
});

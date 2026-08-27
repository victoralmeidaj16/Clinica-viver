import { afterEach, describe, expect, it, vi } from 'vitest';
import { buscarEnderecoPorCep } from './patientRegistration';

afterEach(() => vi.unstubAllGlobals());

describe('consulta de CEP do cadastro interno', () => {
  it('mapeia endereço encontrado pelo ViaCEP', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({
      logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP',
    }) }));
    await expect(buscarEnderecoPorCep('01001-000')).resolves.toEqual({
      logradouro: 'Praça da Sé', bairro: 'Sé', cidade: 'São Paulo', uf: 'SP',
    });
  });

  it('preserva cidade e UF em CEP geral sem rua ou bairro', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ localidade: 'Brasília', uf: 'DF' }) }));
    await expect(buscarEnderecoPorCep('70000-000')).resolves.toEqual({
      logradouro: '', bairro: '', cidade: 'Brasília', uf: 'DF',
    });
  });

  it('libera fallback manual quando o CEP não existe ou a rede falha', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ json: async () => ({ erro: true }) })
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(buscarEnderecoPorCep('99999-999')).resolves.toBeNull();
    await expect(buscarEnderecoPorCep('01001-000')).resolves.toBeNull();
  });
});

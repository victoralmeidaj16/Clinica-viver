import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';

const consulta = vi.hoisted(() => ({ dps: vi.fn(), nfse: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/server/fiscal/sefinNacional', () => ({
  consultarChavePorDps: consulta.dps,
  consultarNfsePorChave: consulta.nfse,
}));

import { recuperarNotaPorDps } from './nfseEmissionService';

describe('recuperação de NFS-e pela DPS', () => {
  it('recupera o XML verdadeiro e a chave antes de marcar a nota emitida', async () => {
    const chave = '1'.repeat(50);
    const xml = `<NFSe><infNFSe Id="NFS${chave}"><nNFSe>42</nNFSe><DPS><infDPS /></DPS></infNFSe></NFSe>`;
    consulta.dps.mockResolvedValue({ status: 200, corpo: JSON.stringify({ chaveAcesso: chave }), json: { chaveAcesso: chave } });
    consulta.nfse.mockResolvedValue({ status: 200, corpo: '{}', json: { nfseXmlGZipB64: gzipSync(xml).toString('base64') } });
    const resultado = await recuperarNotaPorDps('dps-ficticia');
    expect(consulta.nfse).toHaveBeenCalledWith(chave);
    expect(resultado.nota).toEqual({ chaveAcesso: chave, nfseXml: xml, numeroNfse: '42' });
  });

  it('recusa a recuperação quando a consulta não devolve o documento', async () => {
    const chave = '2'.repeat(50);
    consulta.dps.mockResolvedValue({ status: 200, corpo: '', json: { chaveAcesso: chave } });
    consulta.nfse.mockResolvedValue({ status: 200, corpo: '{}', json: {} });
    await expect(recuperarNotaPorDps('dps-ficticia')).rejects.toThrow('não retornou o XML');
  });
});

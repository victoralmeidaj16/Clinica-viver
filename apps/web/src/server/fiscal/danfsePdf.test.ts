import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { gerarDanfsePdf } from './danfsePdf';
import { parseNfseXml } from './nfseXmlView';

const XML = `<?xml version="1.0" encoding="utf-8"?>
<NFSe xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">
  <infNFSe Id="NFS42187072219440737000153000000000129926083555565516">
    <xLocEmi>Tubarão</xLocEmi><xLocPrestacao>Tubarão</xLocPrestacao>
    <nNFSe>1299</nNFSe><xTribNac>Psicologia.</xTribNac><xNBS>Serviços de psicologia</xNBS>
    <cStat>100</cStat><dhProc>2026-08-21T16:31:11-03:00</dhProc>
    <emit><CNPJ>19440737000153</CNPJ><IM>68870</IM><xNome>Clínica Exemplo</xNome>
      <enderNac><xLgr>Rua Exemplo</xLgr><nro>20</nro><xBairro>Centro</xBairro><UF>SC</UF><CEP>88701150</CEP></enderNac>
    </emit><valores><vLiq>75.00</vLiq></valores>
    <DPS versao="1.01"><infDPS Id="DPS421870721944073700015300001000000000000001">
      <tpAmb>1</tpAmb><dhEmi>2026-08-21T16:31:10-03:00</dhEmi><serie>00001</serie><nDPS>1</nDPS><dCompet>2026-08-21</dCompet>
      <toma><CPF>12345678909</CPF><xNome>Paciente Exemplo</xNome><email>paciente@example.com</email></toma>
      <serv><cServ><cTribNac>041601</cTribNac><xDescServ>Atendimento psicoterápico em 21/08/2026 às 08:00.</xDescServ><cNBS>123019800</cNBS></cServ></serv>
      <valores><vServPrest><vServ>75.00</vServ></vServPrest><trib><totTrib><pTotTribSN>0.00</pTotTribSN></totTrib></trib></valores>
    </infDPS></DPS>
  </infNFSe>
</NFSe>`;

describe('DANFSe a partir do XML oficial', () => {
  it('extrai os dados fiscais sem depender da cobrança', () => {
    expect(parseNfseXml(XML)).toMatchObject({
      numero: '1299', competencia: '2026-08-21', ambiente: 'Produção',
      prestador: { nome: 'Clínica Exemplo' }, tomador: { nome: 'Paciente Exemplo' },
      valorServico: 75, valorLiquido: 75,
    });
  });

  it('gera um PDF A4 que pode ser visualizado ou salvo', async () => {
    const pdf = await gerarDanfsePdf(XML);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.byteLength).toBeGreaterThan(4_000);
  });

  it('recusa XML que não seja uma NFS-e Nacional', () => {
    expect(() => parseNfseXml('<documento />')).toThrow('NFS-e Nacional válida');
  });
});

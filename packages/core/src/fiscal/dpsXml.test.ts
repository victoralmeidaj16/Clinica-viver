import { describe, expect, it } from 'vitest';
import { gerarDpsPsicologia } from './dpsXml';

const base = {
  ambiente: '2' as const,
  serie: 1,
  numeroDps: 42,
  competencia: '2026-08-13',
  emitidoEm: '2026-08-13T14:30:00-03:00',
  versaoAplicativo: 'viver-mais-0.1',
  prestador: {
    cnpj: '19.440.737/0001-53',
    inscricaoMunicipal: '68870',
    codigoMunicipioIbge: '4218707',
    opcaoSimplesNacional: '3' as const,
    regimeApuracaoSimples: '1' as const,
    regimeEspecialTributacao: '0' as const,
  },
  tomador: { cpfOuCnpj: '311.237.718-47', nome: 'Denise & Filhos', email: 'denise@example.com' },
  valorCents: 7_500,
  descricaoServico: 'Atendimento Psicoterápico.',
  codigoTributacaoNacional: '04.16.01',
  codigoNbs: '1.2301.98.00',
  codigoMunicipioPrestacao: '4218707',
};

describe('gerarDpsPsicologia', () => {
  it('gera a DPS v1.01 na ordem do XSD para a emissão normal da clínica', () => {
    const dps = gerarDpsPsicologia(base);

    expect(dps.id).toBe('DPS421870721944073700015300001000000000000042');
    expect(dps.xml).toContain('<DPS xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">');
    expect(dps.xml).toContain('<tpAmb>2</tpAmb>');
    expect(dps.xml).toContain('<dCompet>2026-08-13</dCompet>');
    expect(dps.xml).toContain('<CNPJ>19440737000153</CNPJ>');
    expect(dps.xml).toContain('<CPF>31123771847</CPF>');
    expect(dps.xml).toContain('<xNome>Denise &amp; Filhos</xNome>');
    expect(dps.xml).toContain('<cTribNac>041601</cTribNac>');
    expect(dps.xml).toContain('<cNBS>123019800</cNBS>');
    expect(dps.xml).toContain('<vServ>75.00</vServ>');
    expect(dps.xml).toContain('<tribISSQN>1</tribISSQN>');
    expect(dps.xml).toContain('<tpRetISSQN>1</tpRetISSQN>');
    expect(dps.xml).toContain('<indTotTrib>0</indTotTrib>');
    expect(dps.xml).not.toContain('<IBSCBS>');
  });

  it('rejeita inscrição do tomador inválida antes de assinar o XML', () => {
    expect(() => gerarDpsPsicologia({ ...base, tomador: { ...base.tomador, cpfOuCnpj: '111.111.111-11' } })).toThrow(/CPF ou CNPJ/);
  });

  it('rejeita série do emissor web para aplicativo próprio', () => {
    expect(() => gerarDpsPsicologia({ ...base, serie: 70_000 })).toThrow(/série própria/);
  });
});

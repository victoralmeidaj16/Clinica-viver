import { describe, expect, it } from 'vitest';
import { gerarPedidoCancelamentoNfse } from './eventoNfse';

const chave = '4'.padEnd(50, '7');

const base = {
  ambiente: '2' as const,
  chaveAcesso: chave,
  cnpjAutor: '19.440.737/0001-53',
  numeroPedido: 1,
  ocorridoEm: '2026-08-17T14:30:00-03:00',
  versaoAplicativo: 'viver-mais-1.0',
  codigoMotivo: '1',
  motivo: 'Sessão lançada em duplicidade no fechamento.',
};

describe('gerarPedidoCancelamentoNfse', () => {
  it('monta o pedido do evento 101101 com Id, chave e justificativa', () => {
    const pedido = gerarPedidoCancelamentoNfse(base);

    expect(pedido.tipoEvento).toBe('101101');
    expect(pedido.id).toBe(`PRE${chave}101101`);
    expect(pedido.xml).toContain('<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.01">');
    expect(pedido.xml).toContain(`<infPedReg Id="PRE${chave}101101">`);
    expect(pedido.xml).toContain('<tpAmb>2</tpAmb>');
    expect(pedido.xml).toContain(`<chNFSe>${chave}</chNFSe>`);
    expect(pedido.xml).toContain('<CNPJAutor>19440737000153</CNPJAutor>');
    expect(pedido.xml).toContain('<cMotivo>1</cMotivo>');
    expect(pedido.xml).toContain('<xMotivo>Sessão lançada em duplicidade no fechamento.</xMotivo>');
  });

  // As três regressões que levaram o `E1235 — Pattern constraint failed` na
  // produção restrita. Cada uma é verificável sem rede, e nenhuma delas era
  // visível pelo XML "parecer certo".
  it('compõe o Id com 56 dígitos — chave e tipo do evento, sem o sequencial', () => {
    const pedido = gerarPedidoCancelamentoNfse({ ...base, numeroPedido: 7 });

    expect(pedido.id).toMatch(/^PRE\d{56}$/);
    expect(pedido.id).toHaveLength(59);
    // O sequencial é controle da clínica: não entra no Id nem no XML.
    expect(pedido.id.endsWith('007')).toBe(false);
    expect(pedido.numeroPedido).toBe('7');
  });

  it('não emite nPedRegEvento, que não existe na sequência de TCInfPedReg', () => {
    expect(gerarPedidoCancelamentoNfse(base).xml).not.toContain('nPedRegEvento');
  });

  it('respeita a ordem do esquema: o autor vem antes da chave', () => {
    const xml = gerarPedidoCancelamentoNfse(base).xml;

    expect(xml.indexOf('<CNPJAutor>')).toBeLessThan(xml.indexOf('<chNFSe>'));
    expect(xml.indexOf('<dhEvento>')).toBeLessThan(xml.indexOf('<CNPJAutor>'));
    expect(xml.indexOf('<chNFSe>')).toBeLessThan(xml.indexOf('<e101101>'));
  });

  it('aceita apenas os motivos da tabela TSCodJustCanc', () => {
    for (const codigo of ['1', '2', '9']) {
      expect(gerarPedidoCancelamentoNfse({ ...base, codigoMotivo: codigo }).xml)
        .toContain(`<cMotivo>${codigo}</cMotivo>`);
    }
    for (const codigo of ['3', '10', '0', '']) {
      expect(() => gerarPedidoCancelamentoNfse({ ...base, codigoMotivo: codigo })).toThrow(/motivo do cancelamento/);
    }
  });

  it('escapa a justificativa antes de fechar o XML', () => {
    const pedido = gerarPedidoCancelamentoNfse({ ...base, motivo: 'Cobrança do convênio <Unimed> & retrabalho.' });

    expect(pedido.xml).toContain('<xMotivo>Cobrança do convênio &lt;Unimed&gt; &amp; retrabalho.</xMotivo>');
  });

  it('recusa chave de acesso que não tem os 50 dígitos', () => {
    expect(() => gerarPedidoCancelamentoNfse({ ...base, chaveAcesso: '123' })).toThrow(/chave de acesso/);
  });

  it('recusa justificativa curta demais para explicar o cancelamento', () => {
    expect(() => gerarPedidoCancelamentoNfse({ ...base, motivo: 'Erro.' })).toThrow(/justificativa/);
  });

  it('recusa data do evento sem offset de fuso', () => {
    expect(() => gerarPedidoCancelamentoNfse({ ...base, ocorridoEm: '2026-08-17T14:30:00' })).toThrow(/offset/);
  });

  it('recusa sequencial de pedido fora da faixa do leiaute', () => {
    expect(() => gerarPedidoCancelamentoNfse({ ...base, numeroPedido: 0 })).toThrow(/sequencial/);
    expect(() => gerarPedidoCancelamentoNfse({ ...base, numeroPedido: 1_000 })).toThrow(/sequencial/);
  });
});

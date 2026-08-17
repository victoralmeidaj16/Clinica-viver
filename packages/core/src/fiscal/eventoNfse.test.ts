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
    expect(pedido.id).toBe(`PRE${chave}101101001`);
    expect(pedido.xml).toContain('<pedRegEvento xmlns="http://www.sped.fazenda.gov.br/nfse" versao="1.00">');
    expect(pedido.xml).toContain(`<infPedReg Id="PRE${chave}101101001">`);
    expect(pedido.xml).toContain('<tpAmb>2</tpAmb>');
    expect(pedido.xml).toContain('<nPedRegEvento>1</nPedRegEvento>');
    expect(pedido.xml).toContain(`<chNFSe>${chave}</chNFSe>`);
    expect(pedido.xml).toContain('<CNPJAutor>19440737000153</CNPJAutor>');
    expect(pedido.xml).toContain('<cMotivo>1</cMotivo>');
    expect(pedido.xml).toContain('<xMotivo>Sessão lançada em duplicidade no fechamento.</xMotivo>');
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

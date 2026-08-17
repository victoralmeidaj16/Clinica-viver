import { codigo, dataHoraComOffset, escaparXml, somenteDigitos, textoObrigatorio } from './xmlFiscal';

/**
 * Pedido de registro de evento da NFS-e nacional.
 *
 * Nota fiscal emitida não se apaga: cancela-se por um **evento**, que é outro
 * documento assinado, enviado a `POST /nfse/{chaveAcesso}/eventos`. O evento
 * `101101` é o cancelamento por iniciativa do prestador.
 *
 * O leiaute abaixo segue `pedRegEvento_v1.00.xsd` e o Anexo I do Manual dos
 * Contribuintes. Duas coisas aqui **precisam ser confirmadas contra o MOC
 * vigente antes do primeiro cancelamento em produção**, porque errá-las produz
 * rejeição e não perda de dado:
 *
 *  1. a composição do `Id` (`PRE` + chave + tipo do evento + sequencial); e
 *  2. a tabela de `cMotivo` do grupo `e101101` — este módulo valida o formato
 *     do código, não o significado dele, justamente para não inventar uma
 *     tabela que o manual define.
 *
 * O prazo de cancelamento também é municipal: passado o prazo, a via é a
 * substituição da nota, que é outro evento e outro gerador.
 */

export const NAMESPACE_NFSE_EVENTO = 'http://www.sped.fazenda.gov.br/nfse';
export const VERSAO_PEDIDO_EVENTO = '1.00';

/** Cancelamento de NFS-e por solicitação do emitente. */
export const TIPO_EVENTO_CANCELAMENTO = '101101';

export interface PedidoCancelamentoInput {
  /** `1` produção, `2` produção restrita. */
  ambiente: '1' | '2';
  /** Chave de acesso da NFS-e a cancelar — 50 dígitos. */
  chaveAcesso: string;
  /** CNPJ de quem pede o evento; é o titular do certificado que assina. */
  cnpjAutor: string;
  /** Sequencial do pedido para esta nota e este tipo de evento, a partir de 1. */
  numeroPedido: number | string;
  /** Data/hora do evento com offset, por exemplo `2026-08-17T14:30:00-03:00`. */
  ocorridoEm: string;
  versaoAplicativo: string;
  /** Código do motivo, conforme a tabela do Anexo I. */
  codigoMotivo: string;
  /** Justificativa, que fica registrada na nota e é visível ao tomador. */
  motivo: string;
}

export interface PedidoEventoGerado {
  id: string;
  tipoEvento: string;
  numeroPedido: string;
  xml: string;
}

function numeroPedidoEvento(valor: number | string): string {
  const numero = somenteDigitos(valor);
  if (!/^[1-9]\d{0,2}$/.test(numero)) {
    throw new Error('O sequencial do pedido de evento deve estar entre 1 e 999.');
  }
  return numero;
}

/**
 * Monta e devolve o XML do pedido, **sem assinatura**.
 *
 * A assinatura XMLDSig é aplicada depois, sobre `infPedReg`, pelo mesmo
 * caminho que assina a DPS.
 */
export function gerarPedidoCancelamentoNfse(input: PedidoCancelamentoInput): PedidoEventoGerado {
  const chaveAcesso = codigo(input.chaveAcesso, 'A chave de acesso da NFS-e', 50);
  const cnpjAutor = codigo(input.cnpjAutor, 'O CNPJ do autor do evento', 14);
  const codigoMotivo = somenteDigitos(input.codigoMotivo);
  if (!/^\d{1,2}$/.test(codigoMotivo)) {
    throw new Error('O código do motivo do cancelamento deve ter 1 ou 2 dígitos.');
  }
  // O mínimo existe para que a justificativa signifique algo: "erro" não conta
  // por que a nota foi cancelada, e é o tomador que lê esse campo.
  const motivo = textoObrigatorio(input.motivo, 'A justificativa do cancelamento', 255, 15);
  const versaoAplicativo = textoObrigatorio(input.versaoAplicativo, 'A versão do aplicativo emissor', 20);
  const ocorridoEm = dataHoraComOffset(input.ocorridoEm, 'A data/hora do evento');
  const numeroPedido = numeroPedidoEvento(input.numeroPedido);

  const id = `PRE${chaveAcesso}${TIPO_EVENTO_CANCELAMENTO}${numeroPedido.padStart(3, '0')}`;

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<pedRegEvento xmlns="${NAMESPACE_NFSE_EVENTO}" versao="${VERSAO_PEDIDO_EVENTO}">
  <infPedReg Id="${id}">
    <tpAmb>${input.ambiente}</tpAmb>
    <verAplic>${escaparXml(versaoAplicativo)}</verAplic>
    <dhEvento>${ocorridoEm}</dhEvento>
    <nPedRegEvento>${numeroPedido}</nPedRegEvento>
    <chNFSe>${chaveAcesso}</chNFSe>
    <CNPJAutor>${cnpjAutor}</CNPJAutor>
    <e${TIPO_EVENTO_CANCELAMENTO}>
      <xDesc>Cancelamento de NFS-e</xDesc>
      <cMotivo>${codigoMotivo}</cMotivo>
      <xMotivo>${escaparXml(motivo)}</xMotivo>
    </e${TIPO_EVENTO_CANCELAMENTO}>
  </infPedReg>
</pedRegEvento>`;

  return { id, tipoEvento: TIPO_EVENTO_CANCELAMENTO, numeroPedido, xml };
}

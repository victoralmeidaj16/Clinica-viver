import { codigo, dataHoraComOffset, escaparXml, somenteDigitos, textoObrigatorio } from './xmlFiscal';

/**
 * Pedido de registro de evento da NFS-e nacional.
 *
 * Nota fiscal emitida não se apaga: cancela-se por um **evento**, que é outro
 * documento assinado, enviado a `POST /nfse/{chaveAcesso}/eventos`. O evento
 * `101101` é o cancelamento por iniciativa do prestador.
 *
 * O leiaute segue `pedRegEvento_v1.01.xsd` do pacote oficial
 * `NFSe-ESQUEMAS_XSD-v1.01-20260209`, em gov.br/nfse → Documentação Técnica →
 * Documentação Atual:
 *
 *     https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica/documentacao-atual/nfse-esquemas_xsd-v1-01-20260209.zip
 *
 * O XML gerado aqui foi validado contra esse esquema com
 * `xmllint --schema pedRegEvento_v1.01.xsd`, e é assim que se confere uma
 * alteração neste arquivo sem depender de uma chamada à SEFIN.
 *
 * ## O que a produção restrita recusava, e por quê
 *
 * Em agosto/2026 a emissão funcionava ponta a ponta e o cancelamento não: o
 * `SefinNacional_1.6.0` devolvia
 *
 *     E1235 — The 'Id' attribute is invalid ... datatype 'TSIdPedRegEvt'
 *             The Pattern constraint failed.
 *
 * Foram sondadas 14 composições de `Id` às cegas, todas recusadas. A resposta
 * estava no XSD, e são **três** defeitos, não um:
 *
 *  1. **O `Id` tinha três dígitos a mais.** `tiposSimples_v1.01.xsd` define
 *     `TSIdPedRegEvt` como `maxLength 59` e `pattern "PRE[0-9]{56}"`. São 56
 *     dígitos = chave de acesso (50) + tipo do evento (6). O sequencial do
 *     pedido **não entra** — quem o carrega é o `Id` do evento devolvido pela
 *     SEFIN (`TSIdEvento`, `EVT[0-9]{59}`, que soma os 3 dígitos do
 *     `nPedRegEvento`). Confundir os dois era o erro.
 *  2. **`<nPedRegEvento>` não existe no pedido.** A sequência de `TCInfPedReg`
 *     é `tpAmb`, `verAplic`, `dhEvento`, (`CNPJAutor`|`CPFAutor`), `chNFSe` e o
 *     grupo do evento. O elemento era invenção nossa, em nenhuma das versões do
 *     esquema.
 *  3. **`CNPJAutor` e `chNFSe` estavam trocados.** A sequência é ordenada, e o
 *     XSD põe o autor antes da chave.
 *
 * O padrão `PRE[0-9]{56}` é idêntico em 1.00 e 1.01 — nunca mudou. O que muda
 * entre as versões é só o nome do tipo (`TSIdPedRefEvt` em 1.00), o que
 * descarta a hipótese de leiaute antigo.
 *
 * ## O que ainda depende do município
 *
 * O `cMotivo` é a tabela `TSCodJustCanc`, que o esquema fecha em três valores —
 * 1 erro na emissão, 2 serviço não prestado, 9 outros — e este módulo agora
 * recusa qualquer outro. Já o **prazo** de cancelamento é municipal: vencido
 * ele, a via é a substituição da nota, que é outro evento (`105102`) e outro
 * gerador.
 */

export const NAMESPACE_NFSE_EVENTO = 'http://www.sped.fazenda.gov.br/nfse';
/**
 * `TVerNFSe` aceita `1.00` e `1.01`, e a estrutura do cancelamento é idêntica
 * nas duas — voltar atrás é trocar esta constante e mais nada.
 */
export const VERSAO_PEDIDO_EVENTO = '1.01';

/** Cancelamento de NFS-e por solicitação do emitente. */
export const TIPO_EVENTO_CANCELAMENTO = '101101';

/** Tabela `TSCodJustCanc` do esquema: os únicos motivos que a SEFIN aceita. */
export const MOTIVOS_CANCELAMENTO_NFSE = ['1', '2', '9'] as const;
export type MotivoCancelamentoNfse = (typeof MOTIVOS_CANCELAMENTO_NFSE)[number];

export interface PedidoCancelamentoInput {
  /** `1` produção, `2` produção restrita. */
  ambiente: '1' | '2';
  /** Chave de acesso da NFS-e a cancelar — 50 dígitos. */
  chaveAcesso: string;
  /** CNPJ de quem pede o evento; é o titular do certificado que assina. */
  cnpjAutor: string;
  /**
   * Sequencial do pedido para esta nota e este tipo de evento, a partir de 1.
   *
   * Controle da clínica: não entra no `Id` nem no XML — é a SEFIN que o devolve
   * no `Id` do evento registrado. Fica aqui porque é ele que identifica a
   * tentativa na trilha fiscal quando um pedido falha e outro é enviado.
   */
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
  // `TSCodJustCanc` fecha a tabela em três valores. Aceitar dois dígitos
  // quaisquer, como antes, só adiava a recusa para dentro da SEFIN.
  const codigoMotivo = somenteDigitos(input.codigoMotivo);
  if (!MOTIVOS_CANCELAMENTO_NFSE.includes(codigoMotivo as MotivoCancelamentoNfse)) {
    throw new Error('O motivo do cancelamento deve ser 1 (erro na emissão), 2 (serviço não prestado) ou 9 (outros).');
  }
  // O mínimo existe para que a justificativa signifique algo: "erro" não conta
  // por que a nota foi cancelada, e é o tomador que lê esse campo.
  const motivo = textoObrigatorio(input.motivo, 'A justificativa do cancelamento', 255, 15);
  const versaoAplicativo = textoObrigatorio(input.versaoAplicativo, 'A versão do aplicativo emissor', 20);
  const ocorridoEm = dataHoraComOffset(input.ocorridoEm, 'A data/hora do evento');
  const numeroPedido = numeroPedidoEvento(input.numeroPedido);

  // `PRE` + chave (50) + tipo do evento (6) = os 56 dígitos de `TSIdPedRegEvt`.
  const id = `PRE${chaveAcesso}${TIPO_EVENTO_CANCELAMENTO}`;
  if (!/^PRE\d{56}$/.test(id)) {
    throw new Error('O Id do pedido de evento não respeita o padrão PRE seguido de 56 dígitos.');
  }

  // A sequência de `TCInfPedReg` é ordenada: autor antes da chave.
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<pedRegEvento xmlns="${NAMESPACE_NFSE_EVENTO}" versao="${VERSAO_PEDIDO_EVENTO}">
  <infPedReg Id="${id}">
    <tpAmb>${input.ambiente}</tpAmb>
    <verAplic>${escaparXml(versaoAplicativo)}</verAplic>
    <dhEvento>${ocorridoEm}</dhEvento>
    <CNPJAutor>${cnpjAutor}</CNPJAutor>
    <chNFSe>${chaveAcesso}</chNFSe>
    <e${TIPO_EVENTO_CANCELAMENTO}>
      <xDesc>Cancelamento de NFS-e</xDesc>
      <cMotivo>${codigoMotivo}</cMotivo>
      <xMotivo>${escaparXml(motivo)}</xMotivo>
    </e${TIPO_EVENTO_CANCELAMENTO}>
  </infPedReg>
</pedRegEvento>`;

  return { id, tipoEvento: TIPO_EVENTO_CANCELAMENTO, numeroPedido, xml };
}

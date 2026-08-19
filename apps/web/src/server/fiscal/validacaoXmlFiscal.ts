import 'server-only';

import { DOMParser } from '@xmldom/xmldom';
import { SignedXml } from 'xml-crypto';
import type { CertificadoNfse } from './certificadoNfse';

const NS_NFSE = 'http://www.sped.fazenda.gov.br/nfse';
const NS_DSIG = 'http://www.w3.org/2000/09/xmldsig#';

// Perfil publicado pelo Manual Integrado da NFS-e Nacional: XMLDSig
// enveloped, RSA/SHA-1 e C14N inclusiva. Deixar esta validação no servidor
// evita que uma mudança acidental de biblioteca produza XML aceito pelo parser
// local, mas rejeitado pela SEFIN.
export const PERFIL_ASSINATURA_DPS = {
  canonicalizacao: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  assinatura: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
  digest: 'http://www.w3.org/2000/09/xmldsig#sha1',
  enveloped: 'http://www.w3.org/2000/09/xmldsig#enveloped-signature',
} as const;

function elementos(documento: Document, namespace: string, nome: string): Element[] {
  return Array.from(documento.getElementsByTagNameNS(namespace, nome));
}

function texto(elemento: Element | undefined): string | undefined {
  return elemento?.textContent?.trim() || undefined;
}

interface LeiauteFiscal {
  /** Elemento raiz do documento, como o esquema o nomeia. */
  raiz: string;
  /** Elemento assinado, que carrega o atributo `Id`. */
  elementoAssinado: string;
  /** Versões do leiaute aceitas no atributo `versao` da raiz. */
  versoes: readonly string[];
  /** Padrão do `Id`, conforme o tipo simples do esquema. */
  padraoId: RegExp;
  /** Como descrever o padrão do `Id` a quem lê o erro. */
  descricaoId: string;
}

/**
 * Pré-validação estrutural do XML que complementa o XSD oficial. Em tempo de
 * execução verificamos também as regras que o XSD deliberadamente não fixa
 * (por exemplo URI e algoritmos XMLDSig), antes de abrir conexão com a SEFIN.
 */
function validarXmlFiscalAssinado(
  xml: string,
  certificado: CertificadoNfse,
  leiaute: LeiauteFiscal
): void {
  const documento = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } }).parseFromString(xml, 'application/xml');
  const raiz = documento.documentElement;
  const versao = raiz?.getAttribute('versao') ?? '';
  if (!raiz || raiz.localName !== leiaute.raiz || raiz.namespaceURI !== NS_NFSE || !leiaute.versoes.includes(versao)) {
    throw new Error(`O XML assinado não está no leiaute NFS-e ${leiaute.raiz} ${leiaute.versoes.join(' ou ')}.`);
  }

  const informacao = elementos(documento, NS_NFSE, leiaute.elementoAssinado);
  const assinatura = elementos(documento, NS_DSIG, 'Signature');
  if (informacao.length !== 1 || assinatura.length !== 1) {
    throw new Error(`O documento deve conter exatamente um ${leiaute.elementoAssinado} e uma assinatura XMLDSig.`);
  }
  const id = informacao[0].getAttribute('Id') ?? '';
  if (!leiaute.padraoId.test(id)) throw new Error(`O Id do documento não respeita o formato ${leiaute.descricaoId}.`);

  const assinaturaMethod = elementos(documento, NS_DSIG, 'SignatureMethod')[0]?.getAttribute('Algorithm');
  const canonicalizacao = elementos(documento, NS_DSIG, 'CanonicalizationMethod')[0]?.getAttribute('Algorithm');
  const digest = elementos(documento, NS_DSIG, 'DigestMethod')[0]?.getAttribute('Algorithm');
  const referencia = elementos(documento, NS_DSIG, 'Reference')[0];
  const transforms = elementos(documento, NS_DSIG, 'Transform').map((item) => item.getAttribute('Algorithm'));
  if (
    assinaturaMethod !== PERFIL_ASSINATURA_DPS.assinatura ||
    canonicalizacao !== PERFIL_ASSINATURA_DPS.canonicalizacao ||
    digest !== PERFIL_ASSINATURA_DPS.digest ||
    referencia?.getAttribute('URI') !== `#${id}` ||
    transforms.length !== 2 || transforms[0] !== PERFIL_ASSINATURA_DPS.enveloped ||
    transforms[1] !== PERFIL_ASSINATURA_DPS.canonicalizacao
  ) {
    throw new Error('A assinatura não corresponde ao perfil XMLDSig exigido pela NFS-e Nacional.');
  }

  const certificados = elementos(documento, NS_DSIG, 'X509Certificate');
  if (certificados.length !== 1 || !texto(certificados[0])) {
    throw new Error('A assinatura deve conter apenas o certificado final (EndCertOnly).');
  }

  const verificador = new SignedXml({ publicCert: certificado.certificadoPem });
  verificador.loadSignature(assinatura[0]);
  if (!verificador.checkSignature(xml)) {
    throw new Error('A assinatura criptográfica não pôde ser verificada com o certificado da clínica.');
  }
}

/** Declaração de prestação de serviço, antes do envio à SEFIN. */
export function validarDpsAssinada(xml: string, certificado: CertificadoNfse): void {
  validarXmlFiscalAssinado(xml, certificado, {
    raiz: 'DPS',
    elementoAssinado: 'infDPS',
    versoes: ['1.01'],
    padraoId: /^DPS\d{42}$/,
    descricaoId: 'DPS seguido de 42 dígitos',
  });
}

/**
 * Pedido de registro de evento (cancelamento), antes do envio à SEFIN.
 *
 * Existe porque a falta dela custou caro: o pedido saía sem conferência
 * nenhuma, e três defeitos de leiaute — `Id` com o sequencial indevido,
 * `nPedRegEvento` inexistente e a ordem de `CNPJAutor`/`chNFSe` trocada — só
 * apareceram como `E1235` vindo da SEFIN, um de cada vez, depois de 14
 * tentativas. O padrão do `Id` aqui é o `TSIdPedRegEvt` do esquema oficial:
 * `PRE` seguido de 56 dígitos.
 */
export function validarPedidoEventoAssinado(xml: string, certificado: CertificadoNfse): void {
  validarXmlFiscalAssinado(xml, certificado, {
    raiz: 'pedRegEvento',
    elementoAssinado: 'infPedReg',
    versoes: ['1.00', '1.01'],
    padraoId: /^PRE\d{56}$/,
    descricaoId: 'PRE seguido de 56 dígitos',
  });
}

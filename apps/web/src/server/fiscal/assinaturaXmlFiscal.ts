import 'server-only';

import { SignedXml } from 'xml-crypto';
import type { CertificadoNfse } from './certificadoNfse';

/**
 * Assinatura XMLDSig de documento fiscal.
 *
 * O padrão brasileiro (NF-e e, na mesma linhagem, a DPS da NFS-e nacional)
 * assina *um elemento identificado por `Id`*, não o documento inteiro: a
 * referência aponta para `#Id`, passa pelas transformações `enveloped` e C14N,
 * e a `<Signature>` entra como irmã do elemento assinado.
 *
 * Os algoritmos são parâmetros com um padrão, e não constantes escondidas,
 * porque quem manda neles é o manual de orientação do contribuinte da versão
 * em vigor. O padrão abaixo é o perfil clássico do XML fiscal brasileiro
 * (RSA-SHA1 / C14N inclusiva) — **confirme contra o MOC vigente da NFS-e
 * nacional antes da primeira emissão em produção**, porque assinar com o
 * perfil errado só aparece na rejeição da prefeitura.
 */

export interface OpcoesAssinatura {
  /** Valor do atributo `Id` do elemento a assinar (sem o `#`). */
  idDoElemento: string;
  /** Nome do elemento assinado, para posicionar a `<Signature>` como irmã. */
  nomeDoElemento: string;
  algoritmoDeAssinatura?: string;
  algoritmoDeDigest?: string;
  algoritmoDeCanonicalizacao?: string;
}

const RSA_SHA1 = 'http://www.w3.org/2000/09/xmldsig#rsa-sha1';
const SHA1 = 'http://www.w3.org/2000/09/xmldsig#sha1';
const C14N = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const ENVELOPED = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

export function assinarXmlFiscal(
  xml: string,
  certificado: CertificadoNfse,
  opcoes: OpcoesAssinatura
): string {
  const {
    idDoElemento,
    nomeDoElemento,
    algoritmoDeAssinatura = RSA_SHA1,
    algoritmoDeDigest = SHA1,
    algoritmoDeCanonicalizacao = C14N,
  } = opcoes;

  if (!idDoElemento) {
    throw new Error('O elemento a assinar precisa de um atributo Id.');
  }

  const assinatura = new SignedXml({
    privateKey: certificado.chavePrivadaPem,
    publicCert: certificado.certificadoPem,
    signatureAlgorithm: algoritmoDeAssinatura,
    canonicalizationAlgorithm: algoritmoDeCanonicalizacao,
  });

  assinatura.addReference({
    xpath: `//*[@Id='${idDoElemento}']`,
    transforms: [ENVELOPED, algoritmoDeCanonicalizacao],
    digestAlgorithm: algoritmoDeDigest,
    uri: `#${idDoElemento}`,
  });

  // A `<Signature>` fica depois do elemento assinado, não dentro dele: é onde
  // o esquema fiscal a espera, e o `enveloped` remove a própria assinatura do
  // cálculo do digest.
  assinatura.computeSignature(xml, {
    location: { reference: `//*[local-name(.)='${nomeDoElemento}']`, action: 'after' },
  });

  return assinatura.getSignedXml();
}

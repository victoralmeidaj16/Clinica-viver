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

/**
 * Pré-validação estrutural do XML que complementa o XSD oficial. Em tempo de
 * execução verificamos também as regras que o XSD deliberadamente não fixa
 * (por exemplo URI e algoritmos XMLDSig), antes de abrir conexão com a SEFIN.
 */
export function validarDpsAssinada(xml: string, certificado: CertificadoNfse): void {
  const documento = new DOMParser({ errorHandler: { warning() {}, error() {}, fatalError() {} } }).parseFromString(xml, 'application/xml');
  const raiz = documento.documentElement;
  if (!raiz || raiz.localName !== 'DPS' || raiz.namespaceURI !== NS_NFSE || raiz.getAttribute('versao') !== '1.01') {
    throw new Error('A DPS assinada não está no leiaute NFS-e v1.01.');
  }

  const informacao = elementos(documento, NS_NFSE, 'infDPS');
  const assinatura = elementos(documento, NS_DSIG, 'Signature');
  if (informacao.length !== 1 || assinatura.length !== 1) {
    throw new Error('A DPS deve conter exatamente um infDPS e uma assinatura XMLDSig.');
  }
  const dpsId = informacao[0].getAttribute('Id') ?? '';
  if (!/^DPS\d{42}$/.test(dpsId)) throw new Error('O Id da DPS não respeita o formato DPS seguido de 42 dígitos.');

  const assinaturaMethod = elementos(documento, NS_DSIG, 'SignatureMethod')[0]?.getAttribute('Algorithm');
  const canonicalizacao = elementos(documento, NS_DSIG, 'CanonicalizationMethod')[0]?.getAttribute('Algorithm');
  const digest = elementos(documento, NS_DSIG, 'DigestMethod')[0]?.getAttribute('Algorithm');
  const referencia = elementos(documento, NS_DSIG, 'Reference')[0];
  const transforms = elementos(documento, NS_DSIG, 'Transform').map((item) => item.getAttribute('Algorithm'));
  if (
    assinaturaMethod !== PERFIL_ASSINATURA_DPS.assinatura ||
    canonicalizacao !== PERFIL_ASSINATURA_DPS.canonicalizacao ||
    digest !== PERFIL_ASSINATURA_DPS.digest ||
    referencia?.getAttribute('URI') !== `#${dpsId}` ||
    transforms.length !== 2 || transforms[0] !== PERFIL_ASSINATURA_DPS.enveloped ||
    transforms[1] !== PERFIL_ASSINATURA_DPS.canonicalizacao
  ) {
    throw new Error('A assinatura da DPS não corresponde ao perfil XMLDSig exigido pela NFS-e Nacional.');
  }

  const certificados = elementos(documento, NS_DSIG, 'X509Certificate');
  if (certificados.length !== 1 || !texto(certificados[0])) {
    throw new Error('A assinatura da DPS deve conter apenas o certificado final (EndCertOnly).');
  }

  const verificador = new SignedXml({ publicCert: certificado.certificadoPem });
  verificador.loadSignature(assinatura[0]);
  if (!verificador.checkSignature(xml)) {
    throw new Error('A assinatura criptográfica da DPS não pôde ser verificada com o certificado da clínica.');
  }
}

import 'server-only';

import { readFileSync } from 'node:fs';
import tls from 'node:tls';
import forge from 'node-forge';
import {
  avaliarCertificado,
  type AvaliacaoCertificado,
  type DadosCertificado,
} from '@thats-life/core';
import { PRESTADOR_NFSE } from './prestador';

/**
 * Carrega o certificado A1 (ICP-Brasil) usado para assinar a NFS-e.
 *
 * O arquivo nunca vem do repositório: chega por `NFSE_CERT_PFX_PATH` (caminho
 * no disco da VPS) ou `NFSE_CERT_PFX_BASE64` (para hospedagens sem disco
 * persistente). Um `.pfx` versionado é uma chave privada versionada, e a única
 * correção depois do fato é revogar o certificado e comprar outro.
 *
 * A senha valida por `tls.createSecureContext`, que é o próprio OpenSSL do
 * Node: se a senha estiver errada, falha aqui, com mensagem clara, antes de
 * qualquer tentativa de assinatura.
 */

export interface CertificadoNfse {
  dados: DadosCertificado;
  avaliacao: AvaliacaoCertificado;
  /** Certificado do titular, em PEM — vai no `KeyInfo` da assinatura. */
  certificadoPem: string;
  /** Chave privada em PEM. Nunca sai do servidor, nunca vai para log. */
  chavePrivadaPem: string;
  /** Intermediárias e raiz, na ordem em que vieram do arquivo. */
  cadeiaPem: readonly string[];
}

/** Resumo seguro para a tela: diz o estado sem revelar nada de sigiloso. */
export interface StatusCertificadoNfse {
  configurado: boolean;
  apto: boolean;
  titular?: string;
  cnpjTitular?: string | null;
  validoDe?: string;
  validoAte?: string;
  emissor?: string;
  diasParaVencer?: number;
  impedimentos: readonly string[];
  alertas: readonly string[];
}

export class CertificadoNfseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CertificadoNfseError';
  }
}

function lerArquivoPfx(): Buffer | null {
  const base64 = process.env.NFSE_CERT_PFX_BASE64?.trim();
  if (base64) return Buffer.from(base64, 'base64');

  const caminho = process.env.NFSE_CERT_PFX_PATH?.trim();
  if (!caminho) return null;

  try {
    return readFileSync(caminho);
  } catch {
    throw new CertificadoNfseError(
      `O certificado não foi encontrado em ${caminho}. Confira NFSE_CERT_PFX_PATH.`
    );
  }
}

/**
 * Data do X.509 (`YYYYMMDDHHMMSSZ` já convertida pelo forge) em ISO.
 */
function iso(data: Date): string {
  return data.toISOString();
}

function nomeComum(atributos: forge.pki.CertificateField[]): string {
  const cn = atributos.find((campo) => campo.shortName === 'CN' || campo.name === 'commonName');
  return typeof cn?.value === 'string' ? cn.value : '';
}

/**
 * Entre os certificados do arquivo, o do titular é o único que não é uma
 * autoridade certificadora — as demais entradas são a cadeia (intermediárias e
 * raiz), e assinar com a cadeia no lugar do titular produziria uma nota que
 * nenhuma prefeitura aceita.
 */
function separarTitularDaCadeia(certificados: forge.pki.Certificate[]) {
  const titular =
    certificados.find((certificado) => {
      const basicConstraints = certificado.getExtension('basicConstraints') as
        | { cA?: boolean }
        | undefined;
      return !basicConstraints?.cA;
    }) ?? certificados[0];

  return {
    titular,
    cadeia: certificados.filter((certificado) => certificado !== titular),
  };
}

let memoria: { chave: string; certificado: CertificadoNfse } | null = null;

/**
 * Devolve o certificado carregado, ou `null` quando nada foi configurado.
 *
 * Lança apenas quando há configuração e ela está errada — ausência de
 * configuração é um estado legítimo (a clínica ainda não ligou a emissão), e
 * confundir os dois faria a aplicação inteira falhar por falta de uma variável
 * de ambiente opcional.
 */
export function carregarCertificadoNfse(agora = new Date()): CertificadoNfse | null {
  const pfx = lerArquivoPfx();
  if (!pfx) return null;

  const senha = process.env.NFSE_CERT_PASSWORD ?? '';
  if (!senha) {
    throw new CertificadoNfseError(
      'A senha do certificado não está configurada. Defina NFSE_CERT_PASSWORD.'
    );
  }

  // O conteúdo do arquivo entra na chave do cache para que trocar o
  // certificado não exija reiniciar o processo.
  const chaveDeCache = `${pfx.length}:${pfx.subarray(0, 32).toString('hex')}:${senha.length}`;
  if (memoria?.chave === chaveDeCache) {
    return {
      ...memoria.certificado,
      avaliacao: avaliarCertificado(memoria.certificado.dados, {
        cnpjPrestador: PRESTADOR_NFSE.cnpj,
        agora: iso(agora),
      }),
    };
  }

  // Validação da senha pelo próprio OpenSSL, antes do forge: a mensagem daqui
  // é a que diz "senha errada" sem rodeios.
  try {
    tls.createSecureContext({ pfx, passphrase: senha });
  } catch {
    throw new CertificadoNfseError(
      'A senha do certificado está incorreta, ou o arquivo .pfx está corrompido.'
    );
  }

  let certificados: forge.pki.Certificate[];
  let chavePrivadaPem: string;

  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')));
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, senha);

    certificados = p12
      .getBags({ bagType: forge.pki.oids.certBag })
      [forge.pki.oids.certBag]?.map((bag) => bag.cert)
      .filter((cert): cert is forge.pki.Certificate => Boolean(cert)) ?? [];

    const bagsDeChave = [
      ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[
        forge.pki.oids.pkcs8ShroudedKeyBag
      ] ?? []),
      ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
    ];

    const chave = bagsDeChave.find((bag) => bag.key)?.key;
    if (!chave) {
      throw new CertificadoNfseError('O arquivo não contém a chave privada do certificado.');
    }
    chavePrivadaPem = forge.pki.privateKeyToPem(chave);
  } catch (causa) {
    if (causa instanceof CertificadoNfseError) throw causa;
    throw new CertificadoNfseError('Não foi possível ler o certificado digital (.pfx).');
  }

  if (certificados.length === 0) {
    throw new CertificadoNfseError('O arquivo não contém nenhum certificado.');
  }

  const { titular, cadeia } = separarTitularDaCadeia(certificados);

  const dados: DadosCertificado = {
    titular: nomeComum(titular.subject.attributes),
    validoDe: iso(titular.validity.notBefore),
    validoAte: iso(titular.validity.notAfter),
    emissor: nomeComum(titular.issuer.attributes),
  };

  const certificado: CertificadoNfse = {
    dados,
    avaliacao: avaliarCertificado(dados, {
      cnpjPrestador: PRESTADOR_NFSE.cnpj,
      agora: iso(agora),
    }),
    certificadoPem: forge.pki.certificateToPem(titular),
    chavePrivadaPem,
    cadeiaPem: cadeia.map((certificado) => forge.pki.certificateToPem(certificado)),
  };

  memoria = { chave: chaveDeCache, certificado };
  return certificado;
}

/**
 * O certificado, exigindo que ele esteja apto a assinar.
 *
 * É o que a emissão chama: vencido, de outro CNPJ ou fora de vigência não
 * devolve certificado nenhum — a nota não é assinada com um documento que a
 * prefeitura vai recusar.
 */
export function exigirCertificadoNfseApto(agora = new Date()): CertificadoNfse {
  const certificado = carregarCertificadoNfse(agora);

  if (!certificado) {
    throw new CertificadoNfseError(
      'O certificado digital não está configurado. Defina NFSE_CERT_PFX_PATH (ou NFSE_CERT_PFX_BASE64) e NFSE_CERT_PASSWORD.'
    );
  }

  if (!certificado.avaliacao.apto) {
    throw new CertificadoNfseError(
      `O certificado não pode assinar notas: ${certificado.avaliacao.impedimentos.join(' ')}`
    );
  }

  return certificado;
}

/**
 * Material TLS para o mútuo autenticado com a SEFIN.
 *
 * Devolve o `.pfx` e a senha em vez de um `SecureContext` pronto porque é
 * assim que o `https.Agent` os aceita — e é o agente que mantém a conexão viva
 * entre chamadas. A chave privada nunca é extraída: quem a abre é o OpenSSL,
 * dentro do handshake.
 */
export function materialTlsNfse(): { pfx: Buffer; passphrase: string } {
  const pfx = lerArquivoPfx();
  if (!pfx) throw new CertificadoNfseError('O certificado digital não está configurado.');
  return { pfx, passphrase: process.env.NFSE_CERT_PASSWORD ?? '' };
}

/** Mesmo material, como contexto pronto — para quem fala TLS direto. */
export function contextoTlsNfse(): tls.SecureContext {
  return tls.createSecureContext(materialTlsNfse());
}

/**
 * Estado do certificado para a tela da gestão.
 *
 * Um erro de configuração vira impedimento legível em vez de exceção: a tela
 * de diagnóstico existe justamente para ser aberta quando algo está errado.
 */
export function statusCertificadoNfse(agora = new Date()): StatusCertificadoNfse {
  try {
    const certificado = carregarCertificadoNfse(agora);

    if (!certificado) {
      return {
        configurado: false,
        apto: false,
        impedimentos: ['O certificado digital ainda não foi configurado no servidor.'],
        alertas: [],
      };
    }

    return {
      configurado: true,
      apto: certificado.avaliacao.apto,
      titular: certificado.dados.titular,
      cnpjTitular: certificado.avaliacao.cnpjTitular,
      validoDe: certificado.dados.validoDe,
      validoAte: certificado.dados.validoAte,
      emissor: certificado.dados.emissor,
      diasParaVencer: certificado.avaliacao.diasParaVencer,
      impedimentos: certificado.avaliacao.impedimentos,
      alertas: certificado.avaliacao.alertas,
    };
  } catch (causa) {
    return {
      configurado: true,
      apto: false,
      impedimentos: [
        causa instanceof Error ? causa.message : 'Falha ao ler o certificado digital.',
      ],
      alertas: [],
    };
  }
}

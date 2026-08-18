import 'server-only';

import https from 'node:https';
import { gzipSync } from 'node:zlib';
import { exigirCertificadoNfseApto, materialTlsNfse } from './certificadoNfse';

/**
 * Cliente da API do Emissor Público Nacional (Sefin Nacional NFS-e).
 *
 * Toda chamada é autenticada pelo certificado A1 da clínica no próprio TLS —
 * não há token nem senha de API. É o certificado da conexão que a Sefin usa
 * para decidir o que devolver: a chave de acesso de uma NFS-e, por exemplo, só
 * sai se quem pergunta for prestador, tomador ou intermediário daquela nota.
 *
 * Por isso o cliente usa `node:https` e não o `fetch` global: é o caminho em
 * que o `.pfx` entra direto no handshake, sem precisar extrair a chave privada
 * para lugar nenhum.
 *
 * Referência: Manual dos Contribuintes — Sistema Nacional NFS-e, v1.2 (out/2025).
 */

export type AmbienteNfse = 'producao_restrita' | 'producao';

export interface RespostaSefin {
  status: number;
  corpo: string;
  json: unknown;
}

const BASES: Record<AmbienteNfse, string> = {
  producao_restrita: 'https://sefin.producaorestrita.nfse.gov.br/SefinNacional',
  producao: 'https://sefin.nfse.gov.br/SefinNacional',
};

const BASES_PARAMETRIZACAO: Record<AmbienteNfse, string> = {
  producao_restrita: 'https://adn.producaorestrita.nfse.gov.br/parametrizacao',
  producao: 'https://adn.nfse.gov.br/parametrizacao',
};

/** `tpAmb` da DPS: 1 é produção, 2 é o ambiente de testes. */
export const CODIGO_TP_AMB: Record<AmbienteNfse, '1' | '2'> = {
  producao: '1',
  producao_restrita: '2',
};

/**
 * O ambiente **padrão é o restrito**, e produção exige dizer o nome por
 * extenso na variável de ambiente. Uma nota emitida em produção por engano
 * existe de verdade: gera obrigação tributária e só sai por cancelamento.
 * Errar para o lado do ambiente de testes é o único padrão defensável.
 */
export function ambienteNfse(): AmbienteNfse {
  return process.env.NFSE_AMBIENTE?.trim() === 'producao' ? 'producao' : 'producao_restrita';
}

export function baseDaApiNfse(): string {
  return process.env.NFSE_API_URL?.trim().replace(/\/$/, '') || BASES[ambienteNfse()];
}

export function baseDaApiParametrizacaoNfse(): string {
  return process.env.NFSE_PARAMETRIZACAO_API_URL?.trim().replace(/\/$/, '') || BASES_PARAMETRIZACAO[ambienteNfse()];
}

export class SefinNacionalError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly corpo: string
  ) {
    super(message);
    this.name = 'SefinNacionalError';
  }
}

// O agente guarda a conexão TLS entre chamadas: refazer o handshake com o
// certificado a cada requisição é caro e desnecessário.
let agente: https.Agent | null = null;

function agenteTls(): https.Agent {
  if (!agente) agente = new https.Agent({ ...materialTlsNfse(), keepAlive: true });
  return agente;
}

function requisitar(
  metodo: string,
  caminho: string,
  corpoEnviado?: { conteudo: string; tipo: string },
  base = baseDaApiNfse()
): Promise<RespostaSefin> {
  // Recusa antes de abrir a conexão se o certificado não puder assinar: sem
  // isso, um certificado vencido viraria um erro de TLS obscuro no meio do
  // envio, e não uma frase que explica o que aconteceu.
  exigirCertificadoNfseApto();

  const url = new URL(`${base}${caminho}`);

  return new Promise((resolver, rejeitar) => {
    const requisicao = https.request(
      {
        method: metodo,
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        agent: agenteTls(),
        headers: {
          Accept: 'application/json',
          ...(corpoEnviado
            ? {
                'Content-Type': corpoEnviado.tipo,
                'Content-Length': Buffer.byteLength(corpoEnviado.conteudo),
              }
            : {}),
        },
        timeout: 30_000,
      },
      (resposta) => {
        const partes: Buffer[] = [];
        resposta.on('data', (parte: Buffer) => partes.push(parte));
        resposta.on('end', () => {
          const corpo = Buffer.concat(partes).toString('utf8');
          let json: unknown = null;
          try {
            json = corpo ? JSON.parse(corpo) : null;
          } catch {
            // Nem toda resposta é JSON — o XML da NFS-e vem cru.
          }

          const status = resposta.statusCode ?? 0;
          if (status >= 400) {
            rejeitar(
              new SefinNacionalError(
                `A Sefin Nacional recusou a requisição (HTTP ${status}).`,
                status,
                corpo
              )
            );
            return;
          }
          resolver({ status, corpo, json });
        });
      }
    );

    requisicao.on('timeout', () => {
      requisicao.destroy();
      rejeitar(new SefinNacionalError('A Sefin Nacional não respondeu a tempo.', 408, ''));
    });
    requisicao.on('error', (erro) =>
      rejeitar(new SefinNacionalError(`Falha de conexão com a Sefin Nacional: ${erro.message}`, 0, ''))
    );

    if (corpoEnviado) requisicao.write(corpoEnviado.conteudo);
    requisicao.end();
  });
}

/** `GET /{codigoMunicipio}/convenio` na API ADN de parametrização. */
export function consultarConvenioMunicipal(codigoMunicipioIbge: string) {
  return requisitar('GET', `/${codigoMunicipioIbge}/convenio`, undefined, baseDaApiParametrizacaoNfse());
}

/** Consulta de alíquota na API ADN de parametrização. */
export function consultarParametrosDoServico(codigoMunicipioIbge: string, codigoServico: string, competencia: string) {
  return requisitar('GET', `/${codigoMunicipioIbge}/${codigoServico}/${competencia}/aliquota`, undefined, baseDaApiParametrizacaoNfse());
}

/** Consulta de retenções por município/competência na API ADN de parametrização. */
export function consultarParametrosDoContribuinte(codigoMunicipioIbge: string, competencia: string) {
  return requisitar('GET', `/${codigoMunicipioIbge}/${competencia}/retencoes`, undefined, baseDaApiParametrizacaoNfse());
}

/**
 * `POST /nfse` — geração síncrona.
 *
 * Recebe a DPS já assinada compactada em gzip/base64, conforme o Swagger
 * oficial da SEFIN. A resposta é JSON e traz a NFS-e também compactada.
 *
 * Esta é a chamada que cria documento fiscal com valor legal. Quem a invoca
 * precisa ter certeza do ambiente — veja `ambienteNfse()`.
 */
export function enviarDps(xmlAssinado: string) {
  const conteudo = JSON.stringify({ dpsXmlGZipB64: gzipSync(Buffer.from(xmlAssinado, 'utf8')).toString('base64') });
  return requisitar('POST', '/nfse', { conteudo, tipo: 'application/json' });
}

/** `GET /nfse/{chaveAcesso}` */
export function consultarNfsePorChave(chaveAcesso: string) {
  return requisitar('GET', `/nfse/${chaveAcesso}`);
}

/** `GET /dps/{id}` — recupera a chave de acesso a partir do identificador da DPS. */
export function consultarChavePorDps(identificadorDps: string) {
  return requisitar('GET', `/dps/${identificadorDps}`);
}

/**
 * `HEAD /dps/{id}` — só responde se a NFS-e existe, sem revelar a chave.
 *
 * É o que evita emitir a mesma nota duas vezes: antes de reenviar uma DPS que
 * ficou sem resposta, pergunta-se se ela já virou nota.
 */
export async function dpsJaGerouNfse(identificadorDps: string): Promise<boolean> {
  try {
    const resposta = await requisitar('HEAD', `/dps/${identificadorDps}`);
    return resposta.status >= 200 && resposta.status < 300;
  } catch (causa) {
    if (causa instanceof SefinNacionalError && causa.status === 404) return false;
    throw causa;
  }
}

/** `POST /nfse/{chaveAcesso}/eventos` — cancelamento, substituição, manifestação. */
export function registrarEvento(chaveAcesso: string, xmlAssinado: string) {
  // Mesmo envelope da DPS: JSON com o XML compactado em base64. Enviar o XML
  // cru devolvia `HTTP 415 Unsupported Media Type` — o manual é explícito em
  // dizer que as mensagens da API trafegam em JSON, e só o documento fiscal
  // dentro delas é que é XML.
  const conteudo = JSON.stringify({
    pedidoRegistroEventoXmlGZipB64: gzipSync(Buffer.from(xmlAssinado, 'utf8')).toString('base64'),
  });
  return requisitar('POST', `/nfse/${chaveAcesso}/eventos`, {
    conteudo,
    tipo: 'application/json',
  });
}

/** `GET /nfse/{chaveAcesso}/eventos` */
export function consultarEventos(chaveAcesso: string) {
  return requisitar('GET', `/nfse/${chaveAcesso}/eventos`);
}

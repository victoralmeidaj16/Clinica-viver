import 'server-only';

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { request as httpsRequest, type RequestOptions } from 'node:https';
import qrcode from 'qrcode-generator';

const PRODUCTION_URL = 'https://cdpj.partners.bancointer.com.br';
const SANDBOX_URL = 'https://cdpj-sandbox.partners.uatinter.co';
const REQUEST_TIMEOUT_MS = 15_000;

interface TokenResponse { access_token: string; expires_in?: number; }
interface InterCobResponse {
  txid: string;
  status: string;
  location?: string;
  loc?: { location?: string };
  valor?: { original?: string };
  pixCopiaECola?: string;
  pix?: unknown[];
}

export interface InterPixSettlement {
  endToEndId: string;
  amountCents: number;
  receivedAt: string;
}

export interface InterPixCharge {
  id: string;
  status: string;
  value: number;
  pixCopiaECola: string;
  pixQrCode: string;
  settlements: InterPixSettlement[];
}

let tokenCache: { value: string; expiresAt: number } | undefined;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} não configurado no servidor.`);
  return value;
}

function apiUrl(): string {
  const configured = process.env.INTER_API_URL?.trim().replace(/\/$/, '');
  if (configured) {
    if (![PRODUCTION_URL, SANDBOX_URL].includes(configured)) {
      throw new Error('INTER_API_URL precisa apontar para um ambiente oficial do Banco Inter.');
    }
    return configured;
  }
  return process.env.INTER_ENVIRONMENT === 'production' ? PRODUCTION_URL : SANDBOX_URL;
}

function tlsOptions(): Pick<RequestOptions, 'cert' | 'key' | 'pfx' | 'passphrase'> {
  const pfxPath = process.env.INTER_PFX_PATH?.trim();
  if (pfxPath) {
    return {
      pfx: readFileSync(pfxPath),
      passphrase: process.env.INTER_PFX_PASSWORD,
    };
  }
  return {
    cert: readFileSync(requiredEnv('INTER_CERT_PATH')),
    key: readFileSync(requiredEnv('INTER_KEY_PATH')),
    passphrase: process.env.INTER_KEY_PASSWORD,
  };
}

async function interRequest<T>(path: string, input: {
  method?: string;
  token?: string;
  body?: string;
  contentType?: string;
} = {}): Promise<T> {
  const url = new URL(path, apiUrl());
  const body = input.body;
  const headers: Record<string, string | number> = {
    Accept: 'application/json',
    ...(body ? {
      'Content-Type': input.contentType ?? 'application/json',
      'Content-Length': Buffer.byteLength(body),
    } : {}),
    ...(input.token ? { Authorization: `Bearer ${input.token}` } : {}),
  };
  const account = process.env.INTER_ACCOUNT_NUMBER?.replace(/\D/g, '');
  if (account) headers['x-conta-corrente'] = account.replace(/^0+/, '');

  return new Promise<T>((resolve, reject) => {
    const request = httpsRequest({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      method: input.method ?? 'GET',
      headers,
      ...tlsOptions(),
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`Banco Inter respondeu ${response.statusCode ?? 0}: ${text.slice(0, 500)}`));
          return;
        }
        if (!text) { resolve(undefined as T); return; }
        try { resolve(JSON.parse(text) as T); }
        catch { reject(new Error('Banco Inter retornou uma resposta inválida.')); }
      });
    });
    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('Tempo limite da API do Banco Inter.')));
    request.on('error', reject);
    if (body) request.write(body);
    request.end();
  });
}

async function accessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.value;
  const body = new URLSearchParams({
    client_id: requiredEnv('INTER_CLIENT_ID'),
    client_secret: requiredEnv('INTER_CLIENT_SECRET'),
    grant_type: 'client_credentials',
    scope: 'cob.write cob.read',
  }).toString();
  const response = await interRequest<TokenResponse>('/oauth/v2/token', {
    method: 'POST', body, contentType: 'application/x-www-form-urlencoded',
  });
  if (!response.access_token) throw new Error('Banco Inter não retornou um token de acesso.');
  tokenCache = {
    value: response.access_token,
    expiresAt: Date.now() + Math.max(60, response.expires_in ?? 3600) * 1000,
  };
  return tokenCache.value;
}

export function interTxid(externalReference: string): string {
  return `VM${createHash('sha256').update(externalReference).digest('hex').slice(0, 30)}`;
}

function field(id: string, value: string): string {
  return `${id}${String(Buffer.byteLength(value, 'utf8')).padStart(2, '0')}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function emvText(value: string, fallback: string, max: number): string {
  const normalized = value.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 $%*+\-./:]/g, '').trim().toUpperCase();
  return (normalized || fallback).slice(0, max);
}

export function dynamicPixPayload(location: string): string {
  const normalizedLocation = location.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const merchantAccount = field('00', 'BR.GOV.BCB.PIX') + field('25', normalizedLocation);
  // Em QR dinâmico, a URL resolve a cobrança e o campo visual usa o marcador
  // definido pelo BR Code; o txid completo continua na cobrança do Inter.
  const additional = field('05', '***');
  const withoutCrc = [
    field('00', '01'), field('01', '12'), field('26', merchantAccount), field('52', '0000'),
    field('53', '986'), field('58', 'BR'),
    field('59', emvText(process.env.INTER_PIX_RECEIVER_NAME ?? '', 'CLINICA VIVER MAIS', 25)),
    field('60', emvText(process.env.INTER_PIX_RECEIVER_CITY ?? '', 'SAO PAULO', 15)),
    field('62', additional), '6304',
  ].join('');
  return `${withoutCrc}${crc16(withoutCrc)}`;
}

function qrDataUrl(payload: string): string {
  const qr = qrcode(0, 'M');
  qr.addData(payload);
  qr.make();
  return qr.createDataURL(6, 4);
}

export function parseInterPixSettlements(entries: unknown): InterPixSettlement[] {
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return [];
    const pix = entry as Record<string, unknown>;
    const endToEndId = String(pix.endToEndId ?? '');
    const amountCents = Math.round(Number(pix.valor) * 100);
    const receivedAt = new Date(String(pix.horario ?? ''));
    if (!endToEndId || !Number.isSafeInteger(amountCents) || amountCents <= 0
      || Number.isNaN(receivedAt.getTime())) return [];
    return [{ endToEndId, amountCents, receivedAt: receivedAt.toISOString() }];
  });
}

export async function createInterPixCharge(input: {
  externalReference: string;
  amountCents: number;
  patientName: string;
  patientCpf: string;
  description: string;
  dueAt: string;
}): Promise<InterPixCharge> {
  const txid = interTxid(input.externalReference);
  const expiration = Math.max(60, Math.floor((Date.parse(input.dueAt) - Date.now()) / 1000));
  const response = await interRequest<InterCobResponse>(`/pix/v2/cob/${txid}`, {
    method: 'PUT', token: await accessToken(), body: JSON.stringify({
      calendario: { expiracao: expiration },
      devedor: { cpf: input.patientCpf, nome: input.patientName.slice(0, 200) },
      valor: { original: (input.amountCents / 100).toFixed(2) },
      chave: requiredEnv('INTER_PIX_KEY'),
      solicitacaoPagador: input.description.slice(0, 140),
      infoAdicionais: [{ nome: 'Referencia', valor: input.externalReference.slice(0, 50) }],
    }),
  });
  const location = response.location ?? response.loc?.location;
  const payload = response.pixCopiaECola || (location ? dynamicPixPayload(location) : '');
  if (!payload) throw new Error('Banco Inter não retornou o Pix Copia e Cola.');
  return {
    id: txid,
    status: response.status,
    value: Number(response.valor?.original ?? input.amountCents / 100),
    pixCopiaECola: payload,
    pixQrCode: qrDataUrl(payload),
    settlements: parseInterPixSettlements(response.pix),
  };
}

export async function getInterPixCharge(txid: string): Promise<InterPixCharge> {
  const response = await interRequest<InterCobResponse>(`/pix/v2/cob/${encodeURIComponent(txid)}`, {
    token: await accessToken(),
  });
  const location = response.location ?? response.loc?.location;
  const payload = response.pixCopiaECola || (location ? dynamicPixPayload(location) : '');
  if (!payload) throw new Error('Banco Inter não retornou o Pix Copia e Cola.');
  return {
    id: txid, status: response.status, value: Number(response.valor?.original ?? 0),
    pixCopiaECola: payload, pixQrCode: qrDataUrl(payload),
    settlements: parseInterPixSettlements(response.pix),
  };
}

export async function cancelInterPixCharge(txid: string): Promise<void> {
  await interRequest(`/pix/v2/cob/${encodeURIComponent(txid)}`, {
    method: 'PATCH', token: await accessToken(),
    body: JSON.stringify({ status: 'REMOVIDA_PELO_USUARIO_RECEBEDOR' }),
  });
}

export function isInterPixSettled(status: string): boolean {
  return status === 'CONCLUIDA';
}

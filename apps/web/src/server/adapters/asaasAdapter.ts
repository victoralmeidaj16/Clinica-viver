/**
 * Adaptador de Integração com o Gateway Financeiro Asaas (API v3)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export interface AsaasCustomerInput {
  name: string;
  cpfCnpj?: string;
  mobilePhone?: string;
  email?: string;
}

export interface AsaasPaymentInput {
  customerId: string;
  value: number; // Ex: 75.00
  dueDate: string; // YYYY-MM-DD
  description: string;
  billingType?: 'PIX' | 'CREDIT_CARD' | 'BOLETO' | 'UNDEFINED';
  externalReference?: string;
}

export interface AsaasPaymentResult {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  billingType: string;
  status: string;
  dueDate: string;
  invoiceUrl: string;
  bankSlipUrl?: string;
  pixQrCode?: {
    encodedImage: string; // Base64 PNG
    payload: string; // Pix copia e cola
    expirationDate?: string;
  };
}

export interface AsaasIntegrationStatus {
  configured: boolean;
  environment: 'production' | 'sandbox' | 'unknown';
  apiUrl: string;
  apiReachable: boolean;
  credentialsValid: boolean;
  webhookTokenConfigured: boolean;
  webhook: {
    configured: boolean;
    enabled: boolean;
    interrupted: boolean;
    sequential: boolean;
    paymentConfirmed: boolean;
    paymentReceived: boolean;
  };
  ready: boolean;
  issues: string[];
}

const PRODUCTION_API_URL = 'https://api.asaas.com/v3';
const SANDBOX_API_URL = 'https://api-sandbox.asaas.com/v3';
const REQUEST_TIMEOUT_MS = 10_000;

async function withPixQrCode(payment: Record<string, unknown>): Promise<AsaasPaymentResult> {
  let pixData: AsaasPaymentResult['pixQrCode'];
  try {
    const pixRes = await fetch(`${getApiUrl()}/payments/${payment.id}/pixQrCode`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (pixRes.ok) {
      const pixJson = await pixRes.json();
      pixData = {
        encodedImage: pixJson.encodedImage ? `data:image/png;base64,${pixJson.encodedImage}` : '',
        payload: pixJson.payload || '',
        expirationDate: pixJson.expirationDate,
      };
    }
  } catch {
    // A URL da fatura continua válida mesmo se o QR Code estiver indisponível.
  }
  return {
    id: String(payment.id), customer: String(payment.customer), value: Number(payment.value),
    netValue: payment.netValue === undefined ? undefined : Number(payment.netValue),
    billingType: String(payment.billingType), status: String(payment.status),
    dueDate: String(payment.dueDate),
    invoiceUrl: String(payment.invoiceUrl || `https://www.asaas.com/i/${payment.id}`),
    bankSlipUrl: payment.bankSlipUrl ? String(payment.bankSlipUrl) : undefined,
    pixQrCode: pixData,
  };
}

function readEnvFallback(key: string): string | undefined {
  const direct = process.env[key]?.trim();
  if (direct) return direct;

  const candidates = [
    join(process.cwd(), '.env.local'),
    join(process.cwd(), 'apps', 'web', '.env.local'),
    join(process.cwd(), '..', '.env.local'),
  ];

  for (const file of candidates) {
    if (existsSync(file)) {
      try {
        const content = readFileSync(file, 'utf8');
        const match = content.match(new RegExp(`^\\s*${key}\\s*=\\s*['"]?([^'"\\r\\n]+)['"]?`, 'm'));
        if (match?.[1]) return match[1].trim();
      } catch {
        // Ignora erro de leitura e tenta o próximo
      }
    }
  }
  return undefined;
}

function getApiUrl(): string {
  return (readEnvFallback('ASAAS_API_URL') || PRODUCTION_API_URL).replace(/\/$/, '');
}

function getApiKey(): string {
  const key = readEnvFallback('ASAAS_API_KEY') || '';
  return key.replace(/^\\/, '');
}

function getHeaders(): Record<string, string> {
  const cleanedKey = getApiKey();
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'ClinicaViverMais/1.0 (Node.js)',
    'access_token': cleanedKey,
  };
}

function environmentFor(apiUrl: string, apiKey: string): AsaasIntegrationStatus['environment'] {
  const urlEnvironment = apiUrl === PRODUCTION_API_URL
    ? 'production'
    : apiUrl === SANDBOX_API_URL ? 'sandbox' : 'unknown';
  const keyEnvironment = apiKey.startsWith('$aact_prod_')
    ? 'production'
    : apiKey.startsWith('$aact_hmlg_') ? 'sandbox' : 'unknown';
  return urlEnvironment === keyEnvironment ? urlEnvironment : 'unknown';
}

function validateConfiguration(): { apiUrl: string; apiKey: string; environment: AsaasIntegrationStatus['environment'] } {
  const apiUrl = getApiUrl();
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('Chave ASAAS_API_KEY não configurada no ambiente.');
  if (environmentFor(apiUrl, apiKey) === 'unknown') {
    throw new Error('A URL e a chave do Asaas não pertencem ao mesmo ambiente oficial.');
  }
  return { apiUrl, apiKey, environment: environmentFor(apiUrl, apiKey) };
}

async function asaasFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { apiUrl } = validateConfiguration();
  return fetch(`${apiUrl}${path}`, {
    ...init,
    headers: { ...getHeaders(), ...init.headers },
    signal: init.signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/** Diagnóstico seguro: valida a conta e o webhook sem devolver chave ou token. */
export async function getAsaasIntegrationStatus(): Promise<AsaasIntegrationStatus> {
  const apiUrl = getApiUrl();
  const apiKey = getApiKey();
  const environment = environmentFor(apiUrl, apiKey);
  const issues: string[] = [];
  const base = {
    configured: Boolean(apiKey), environment, apiUrl,
    apiReachable: false, credentialsValid: false,
    webhookTokenConfigured: Boolean(readEnvFallback('ASAAS_WEBHOOK_TOKEN')?.trim()),
    webhook: {
      configured: false, enabled: false, interrupted: false, sequential: false,
      paymentConfirmed: false, paymentReceived: false,
    },
  };

  if (!apiKey) issues.push('A chave da API não está configurada no servidor.');
  if (apiKey && environment === 'unknown') {
    issues.push('A URL e a chave não pertencem ao mesmo ambiente oficial do Asaas.');
  }
  if (!base.webhookTokenConfigured) issues.push('O token de autenticação do webhook não está configurado.');
  if (issues.some((issue) => issue.includes('chave') || issue.includes('URL'))) {
    return { ...base, ready: false, issues };
  }

  try {
    const [accountResponse, webhooksResponse] = await Promise.all([
      asaasFetch('/customers?limit=1'),
      asaasFetch('/webhooks'),
    ]);
    base.apiReachable = true;
    base.credentialsValid = accountResponse.ok;
    if (!accountResponse.ok) issues.push(`A API recusou as credenciais (HTTP ${accountResponse.status}).`);

    if (webhooksResponse.ok) {
      const body = await webhooksResponse.json() as { data?: Array<Record<string, unknown>> };
      const webhook = body.data?.find((item) =>
        typeof item.url === 'string' && item.url.endsWith('/api/financeiro/asaas/webhook')
      );
      if (webhook) {
        const events = Array.isArray(webhook.events) ? webhook.events.map(String) : [];
        base.webhook = {
          configured: true,
          enabled: webhook.enabled === true,
          interrupted: webhook.interrupted === true,
          sequential: webhook.sendType === 'SEQUENTIALLY',
          paymentConfirmed: events.includes('PAYMENT_CONFIRMED'),
          paymentReceived: events.includes('PAYMENT_RECEIVED'),
        };
      }
    } else {
      issues.push(`Não foi possível consultar o webhook (HTTP ${webhooksResponse.status}).`);
    }
  } catch (error) {
    issues.push(error instanceof Error ? `Falha ao consultar o Asaas: ${error.message}` : 'Falha ao consultar o Asaas.');
  }

  if (!base.webhook.configured) issues.push('O webhook de conciliação não foi encontrado na conta Asaas.');
  if (base.webhook.configured && !base.webhook.enabled) issues.push('O webhook de conciliação está desativado.');
  if (base.webhook.interrupted) issues.push('A fila do webhook está interrompida no Asaas.');
  if (base.webhook.configured && !base.webhook.sequential) issues.push('Configure o webhook com envio sequencial.');
  if (!base.webhook.paymentConfirmed || !base.webhook.paymentReceived) {
    issues.push('O webhook precisa receber PAYMENT_CONFIRMED e PAYMENT_RECEIVED.');
  }
  const ready = base.credentialsValid && base.webhookTokenConfigured && base.webhook.configured
    && base.webhook.enabled && !base.webhook.interrupted && base.webhook.sequential
    && base.webhook.paymentConfirmed && base.webhook.paymentReceived;
  return { ...base, ready, issues };
}

/**
 * Cria ou busca um cliente no Asaas pelo CPF/Email.
 */
export async function getOrCreateAsaasCustomer(input: AsaasCustomerInput): Promise<string> {
  validateConfiguration();

  // 1. Tenta buscar cliente existente
  if (input.cpfCnpj) {
    const cleanCpf = input.cpfCnpj.replace(/\D/g, '');
    const searchRes = await asaasFetch(`/customers?cpfCnpj=${cleanCpf}`, {
      method: 'GET',
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.data && data.data.length > 0) {
        return data.data[0].id;
      }
    }
  }

  // 2. Se não encontrou, cria novo cliente
  const createRes = await asaasFetch('/customers', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj ? input.cpfCnpj.replace(/\D/g, '') : undefined,
      mobilePhone: input.mobilePhone ? input.mobilePhone.replace(/\D/g, '') : undefined,
      email: input.email || undefined,
      notificationDisabled: false,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Falha ao registrar cliente no Asaas (${createRes.status}).`);
  }

  const newCustomer = await createRes.json();
  return newCustomer.id;
}

/**
 * Cria uma cobrança no Asaas e gera a chave Pix + QR Code.
 */
export async function createAsaasPayment(input: AsaasPaymentInput): Promise<AsaasPaymentResult> {
  const paymentRes = await asaasFetch('/payments', {
    method: 'POST',
    body: JSON.stringify({
      customer: input.customerId,
      billingType: input.billingType || 'UNDEFINED',
      value: input.value,
      dueDate: input.dueDate,
      description: input.description,
      externalReference: input.externalReference,
      postalService: false,
    }),
  });

  if (!paymentRes.ok) {
    const errorBody = await paymentRes.text();
    console.error('[asaas] Erro ao criar cobrança:', paymentRes.status, errorBody);
    throw new Error(`Falha ao criar cobrança no Asaas (${paymentRes.status}): ${errorBody}`);
  }

  return withPixQrCode(await paymentRes.json());
}

export async function findAsaasPaymentByExternalReference(
  externalReference: string
): Promise<AsaasPaymentResult | null> {
  const response = await asaasFetch(
    `/payments?externalReference=${encodeURIComponent(externalReference)}&limit=1`
  );
  if (!response.ok) throw new Error('Falha ao consultar a cobrança no Asaas.');
  const body = await response.json();
  return body.data?.[0] ? withPixQrCode(body.data[0]) : null;
}

export async function getAsaasPayment(id: string): Promise<AsaasPaymentResult> {
  const response = await asaasFetch(`/payments/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error('Falha ao consultar a cobrança no Asaas.');
  return withPixQrCode(await response.json());
}

/** Remove somente uma cobrança ainda aberta; pagamento confirmado nunca é estornado por aqui. */
export async function deleteAsaasPayment(id: string): Promise<boolean> {
  const response = await asaasFetch(`/payments/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (response.status === 404) return true;
  if (!response.ok) throw new Error(`Falha ao remover cobrança no Asaas (${response.status}).`);
  const body = await response.json().catch(() => ({})) as { deleted?: boolean };
  return body.deleted !== false;
}

/** Recupera a linha digitável somente depois de o boleto existir no Asaas. */
export async function getAsaasBoletoIdentificationField(id: string): Promise<string> {
  const response = await asaasFetch(`/payments/${encodeURIComponent(id)}/identificationField`);
  if (!response.ok) throw new Error('Falha ao consultar a linha digitável do boleto no Asaas.');
  const body = await response.json() as Record<string, unknown>;
  const field = String(body.identificationField ?? '').trim();
  if (!field) throw new Error('O Asaas não retornou a linha digitável do boleto.');
  return field;
}

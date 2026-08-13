/**
 * Adaptador de Integração com o Gateway Financeiro Asaas (API v3)
 */

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
  billingType?: 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';
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

const ASAAS_API_URL = process.env.ASAAS_API_URL || 'https://api.asaas.com/v3';
const ASAAS_API_KEY = process.env.ASAAS_API_KEY || '';

function getHeaders(): Record<string, string> {
  // Limpa o prefixo \$ que pode ter sido herdado do .env caso tenha sido escapado
  const cleanedKey = ASAAS_API_KEY.replace(/^\\/, '');
  return {
    'Content-Type': 'application/json',
    'access_token': cleanedKey,
  };
}

/**
 * Cria ou busca um cliente no Asaas pelo CPF/Email.
 */
export async function getOrCreateAsaasCustomer(input: AsaasCustomerInput): Promise<string> {
  if (!ASAAS_API_KEY) {
    throw new Error('Chave ASAAS_API_KEY não configurada no ambiente.');
  }

  // 1. Tenta buscar cliente existente
  if (input.cpfCnpj) {
    const cleanCpf = input.cpfCnpj.replace(/\D/g, '');
    const searchRes = await fetch(`${ASAAS_API_URL}/customers?cpfCnpj=${cleanCpf}`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.data && data.data.length > 0) {
        return data.data[0].id;
      }
    }
  }

  // 2. Se não encontrou, cria novo cliente
  const createRes = await fetch(`${ASAAS_API_URL}/customers`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      name: input.name,
      cpfCnpj: input.cpfCnpj ? input.cpfCnpj.replace(/\D/g, '') : undefined,
      mobilePhone: input.mobilePhone ? input.mobilePhone.replace(/\D/g, '') : undefined,
      email: input.email || undefined,
      notificationDisabled: false,
    }),
  });

  if (!createRes.ok) {
    const errorBody = await createRes.text();
    console.error('Erro ao criar cliente Asaas:', errorBody);
    throw new Error(`Falha ao registrar cliente no Asaas: ${createRes.statusText}`);
  }

  const newCustomer = await createRes.json();
  return newCustomer.id;
}

/**
 * Cria uma cobrança no Asaas e gera a chave Pix + QR Code.
 */
export async function createAsaasPayment(input: AsaasPaymentInput): Promise<AsaasPaymentResult> {
  if (!ASAAS_API_KEY) {
    throw new Error('Chave ASAAS_API_KEY não configurada no ambiente.');
  }

  const paymentRes = await fetch(`${ASAAS_API_URL}/payments`, {
    method: 'POST',
    headers: getHeaders(),
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
    console.error('Erro ao criar cobrança Asaas:', errorBody);
    throw new Error(`Falha ao criar cobrança no Asaas: ${paymentRes.statusText}`);
  }

  const payment = await paymentRes.json();

  // Buscar QR Code Pix se a cobrança permitir Pix
  let pixData: AsaasPaymentResult['pixQrCode'] = undefined;
  try {
    const pixRes = await fetch(`${ASAAS_API_URL}/payments/${payment.id}/pixQrCode`, {
      method: 'GET',
      headers: getHeaders(),
    });

    if (pixRes.ok) {
      const pixJson = await pixRes.json();
      pixData = {
        encodedImage: pixJson.encodedImage ? `data:image/png;base64,${pixJson.encodedImage}` : '',
        payload: pixJson.payload || '',
        expirationDate: pixJson.expirationDate,
      };
    }
  } catch (err) {
    console.warn('Não foi possível obter o QR Code Pix do Asaas para a cobrança:', payment.id, err);
  }

  return {
    id: payment.id,
    customer: payment.customer,
    value: payment.value,
    netValue: payment.netValue,
    billingType: payment.billingType,
    status: payment.status,
    dueDate: payment.dueDate,
    invoiceUrl: payment.invoiceUrl || `https://www.asaas.com/i/${payment.id}`,
    bankSlipUrl: payment.bankSlipUrl,
    pixQrCode: pixData,
  };
}

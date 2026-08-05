import { createHash } from 'node:crypto';
import type {
  BillingProviderPort,
  CreateProviderChargeInput,
  MoneyCents,
  NormalizedBillingWebhook,
  ProviderChargeResult,
} from '@thats-life/core';

/**
 * Provedor de cobrança em modo demonstração.
 *
 * Nenhuma cobrança real é criada: o Asaas não é chamado, nenhum Pix é
 * registrado no Banco Central e nenhum dinheiro se move. O adaptador devolve
 * identificadores e um código Pix sintéticos, marcados como tal, para que o
 * fluxo financeiro completo — cobrança, recibo, conciliação, relatório — rode
 * de ponta a ponta sem efeito no mundo real.
 *
 * Tudo é derivado da referência externa da cobrança, então repetir a operação
 * devolve exatamente os mesmos identificadores. É o mesmo comportamento que a
 * idempotência real precisa garantir quando o Asaas entrar no lugar deste
 * arquivo.
 */

const DEMO_PIX_MARKER = 'DEMONSTRACAO-SEM-VALOR';

export interface DemoCharge {
  readonly providerChargeId: string;
  readonly externalReference: string;
  readonly patientReference: string;
  readonly amountCents: MoneyCents;
  readonly method: CreateProviderChargeInput['method'];
  readonly description: string;
  readonly dueAt: string;
  status: 'pending' | 'paid' | 'cancelled';
  readonly createdAt: string;
}

interface BillingGlobal {
  __thatsLifeDemoCharges?: Map<string, DemoCharge>;
}
const globalScope = globalThis as typeof globalThis & BillingGlobal;

function charges(): Map<string, DemoCharge> {
  if (!globalScope.__thatsLifeDemoCharges) {
    globalScope.__thatsLifeDemoCharges = new Map();
  }
  return globalScope.__thatsLifeDemoCharges;
}

export function listDemoCharges(): readonly DemoCharge[] {
  return [...charges().values()];
}

function digest(value: string, length = 16): string {
  return createHash('sha256').update(value).digest('hex').slice(0, length);
}

/**
 * Monta um payload Pix reconhecivelmente falso. O marcador no meio da string
 * impede que alguém confunda isto com um código copia-e-cola válido.
 */
function buildDemoPixPayload(input: CreateProviderChargeInput): string {
  const reais = (input.amountCents / 100).toFixed(2);
  return `00020126${DEMO_PIX_MARKER}5204000053039865802BR5913THATS LIFE DEMO6009SAO PAULO62${digest(
    input.externalReference,
    12
  ).toUpperCase()}5405${reais}6304DEMO`;
}

export const demoBillingProvider: BillingProviderPort = {
  async createCharge(input: CreateProviderChargeInput): Promise<ProviderChargeResult> {
    const providerChargeId = `pay_demo_${digest(input.externalReference)}`;
    const existing = charges().get(providerChargeId);

    if (!existing) {
      charges().set(providerChargeId, {
        providerChargeId,
        externalReference: input.externalReference,
        patientReference: input.patientReference,
        amountCents: input.amountCents,
        method: input.method,
        description: input.description,
        dueAt: input.dueAt,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
    }

    const charge = charges().get(providerChargeId)!;

    return {
      provider: 'other',
      providerChargeId,
      status: charge.status,
      pixCopyAndPaste: input.method === 'pix' ? buildDemoPixPayload(input) : undefined,
      invoiceUrl: `https://demo.thatslife.local/cobrancas/${providerChargeId}`,
    };
  },

  async cancelCharge(providerChargeId: string): Promise<void> {
    const charge = charges().get(providerChargeId);
    if (charge) {
      charge.status = 'cancelled';
    }
  },

  async refundPayment(
    providerPaymentId: string,
    amountCents: MoneyCents
  ): Promise<{ providerRefundId: string }> {
    return {
      providerRefundId: `refund_demo_${digest(`${providerPaymentId}:${amountCents}`)}`,
    };
  },

  async verifyAndNormalizeWebhook(): Promise<NormalizedBillingWebhook> {
    // Sem provedor real não existe webhook para verificar. Falhar aqui é
    // deliberado: um adaptador de demonstração não deve aceitar como legítimo
    // um evento cuja assinatura ele não tem como validar.
    throw new Error(
      'O provedor de cobrança em modo demonstração não recebe webhooks. Configure o Asaas para habilitar a conciliação automática.'
    );
  },
};

/**
 * Marca uma cobrança de demonstração como paga e devolve o evento normalizado
 * correspondente, permitindo exercitar a conciliação sem um provedor real.
 */
export function simulateDemoPayment(providerChargeId: string): NormalizedBillingWebhook {
  const charge = charges().get(providerChargeId);
  if (!charge) {
    throw new Error(`Cobrança de demonstração ${providerChargeId} não encontrada.`);
  }
  charge.status = 'paid';
  const occurredAt = new Date().toISOString();

  return {
    type: 'payment.confirmed',
    providerEventId: `evt_demo_${digest(`${providerChargeId}:paid`)}`,
    providerChargeId,
    providerPaymentId: `pmt_demo_${digest(providerChargeId)}`,
    amountCents: charge.amountCents,
    occurredAt,
  };
}

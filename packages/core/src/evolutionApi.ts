/**
 * Cliente HTTP da Evolution API para Mensagens Transacionais no WhatsApp
 */

export interface SendWhatsAppMessagePayload {
  instanceName: string;
  number: string; // Ex: "5511987654321"
  text: string;
}

export interface SendPixBillingPayload {
  instanceName: string;
  number: string;
  patientName: string;
  valor: number;
  chavePix: string;
}

export class EvolutionApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    if (!baseUrl.trim() || !apiKey.trim()) {
      throw new Error('Evolution API exige URL e credencial configuradas no servidor.');
    }
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  async sendTextMessage(payload: SendWhatsAppMessagePayload): Promise<{ success: boolean; messageId: string }> {
    try {
      const url = `${this.baseUrl.replace(/\/$/, '')}/message/sendText/${payload.instanceName}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': this.apiKey,
        },
        body: JSON.stringify({
          number: payload.number.replace(/\D/g, ''),
          text: payload.text,
        }),
      });

      if (!response.ok) {
        console.warn(`[EvolutionAPI] Erro ao enviar WhatsApp HTTP ${response.status}`);
        return { success: false, messageId: '' };
      }

      const data = await response.json();
      return {
        success: true,
        messageId: data?.key?.id || `msg_${Date.now()}`,
      };
    } catch (err) {
      console.warn('[EvolutionAPI] Falha de comunicação com servidor:', err);
      return { success: false, messageId: '' };
    }
  }

  async sendPixBilling(payload: SendPixBillingPayload): Promise<{ success: boolean; messageId: string }> {
    const text = `Olá, ${payload.patientName}! 👋\n\nSua sessão na *Viver Mais Psicologia* foi agendada/realizada com sucesso.\n\n💳 *Dados para Pagamento Pix (R$ ${payload.valor},00)*:\n\nCopia e Cola:\n\`\`\`${payload.chavePix}\`\`\`\n\nAgradecemos a confiança! 🧠✨`;
    return this.sendTextMessage({
      instanceName: payload.instanceName,
      number: payload.number,
      text,
    });
  }
}

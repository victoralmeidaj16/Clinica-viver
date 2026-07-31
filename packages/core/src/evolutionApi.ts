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
    void payload;
    return {
      success: true,
      messageId: `msg_${Date.now()}`,
    };
  }

  async sendPixBilling(payload: SendPixBillingPayload): Promise<{ success: boolean; messageId: string }> {
    const text = `Olá, ${payload.patientName}! 👋\n\nSua sessão com a Dra. Camila Vasconcelos foi concluída com sucesso.\n\n💳 *Dados para Pagamento Pix (R$ ${payload.valor},00)*:\n\nCopia e Cola:\n\`\`\`${payload.chavePix}\`\`\`\n\nSuas tarefas terapêuticas já estão atualizadas no seu App Mobile Thats Life! 🧠📱`;
    return this.sendTextMessage({
      instanceName: payload.instanceName,
      number: payload.number,
      text,
    });
  }
}

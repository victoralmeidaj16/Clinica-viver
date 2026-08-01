export interface IntegrationSettings {
  asaas: {
    enabled: boolean;
    apiKey: string;
    environment: 'sandbox' | 'production';
    walletId?: string;
  };
  evolutionApi: {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    instanceName: string;
    qrcodeUrl?: string;
    connectionStatus: 'disconnected' | 'connecting' | 'connected';
  };
}

export function getDefaultIntegrationSettings(): IntegrationSettings {
  return {
    asaas: {
      enabled: false,
      apiKey: '',
      environment: 'sandbox',
    },
    evolutionApi: {
      enabled: false,
      baseUrl: 'https://api.evolution.app',
      apiKey: '',
      instanceName: 'tl_psi_clinic',
      connectionStatus: 'disconnected',
    },
  };
}

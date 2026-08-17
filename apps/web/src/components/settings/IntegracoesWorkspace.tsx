'use client';

import React, { useState } from 'react';
import { ShieldCheck, QrCode, CreditCard, MessageSquare, Check, RefreshCw, Key, Globe } from 'lucide-react';
import { getDefaultIntegrationSettings, type IntegrationSettings } from '@thats-life/core';
import { NfseIntegrationCard } from './NfseIntegrationCard';

export default function IntegracoesWorkspace() {
  const [settings, setSettings] = useState<IntegrationSettings>(getDefaultIntegrationSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [isConnectingEvolution, setIsConnectingEvolution] = useState(false);
  const [qrCodeGenerated, setQrCodeGenerated] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSaveAsaas = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSettings((prev) => ({
        ...prev,
        asaas: { ...prev.asaas, enabled: true },
      }));
      showToast('Integração com Asaas salva e ativada com sucesso!');
    }, 800);
  };

  const handleConnectEvolution = () => {
    setIsConnectingEvolution(true);
    setTimeout(() => {
      setIsConnectingEvolution(false);
      setQrCodeGenerated(true);
      setSettings((prev) => ({
        ...prev,
        evolutionApi: { ...prev.evolutionApi, connectionStatus: 'connecting' },
      }));
    }, 1000);
  };

  const handleSimulateScanQrCode = () => {
    setQrCodeGenerated(false);
    setSettings((prev) => ({
      ...prev,
      evolutionApi: { ...prev.evolutionApi, enabled: true, connectionStatus: 'connected' },
    }));
    showToast('WhatsApp via Evolution API conectado com sucesso!');
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center space-x-2 text-xs font-bold animate-in slide-in-from-top-3">
          <Check className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 text-white p-8 rounded-[28px] shadow-card">
        <div>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
            Hub de Conexões Externas
          </span>
          <h1 className="text-3xl font-extrabold mt-1">Integrações da Clínica</h1>
          <p className="text-xs text-slate-400 mt-2 max-w-xl">
            Acompanhe cobranças, mensagens e a preparação fiscal da NFS-e em um só lugar.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-slate-800/80 px-4 py-2 rounded-2xl border border-slate-700 text-xs font-semibold text-emerald-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>CFP & LGPD Compliant</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Card 1: Integração Asaas (Cobranças / PIX / Cartão) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl border border-blue-100">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Asaas (Cobranças & PIX)</h3>
                  <p className="text-xs text-slate-500">Emissão de boletos, PIX e cartão para pacientes</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                  settings.asaas.enabled
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {settings.asaas.enabled ? 'ATIVADO' : 'INATIVO'}
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Ambiente</label>
                <select
                  value={settings.asaas.environment}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      asaas: {
                        ...settings.asaas,
                        environment: e.target.value as IntegrationSettings['asaas']['environment'],
                      },
                    })
                  }
                  className="w-full text-xs font-semibold p-3 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="sandbox">Sandbox (Ambiente de Testes)</option>
                  <option value="production">Produção (Conta Real Asaas)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Chave de API (API Key Asaas)</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="$aact_YTU5YTE0M2M6..."
                    value={settings.asaas.apiKey}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        asaas: { ...settings.asaas, apiKey: e.target.value },
                      })
                    }
                    className="w-full text-xs font-mono p-3 pl-9 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveAsaas}
            disabled={isSaving || !settings.asaas.apiKey}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-blue-600/20"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            <span>Salvar e Ativar Asaas</span>
          </button>
        </div>

        {/* Card 2: Evolution API (WhatsApp) */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Evolution API (WhatsApp)</h3>
                  <p className="text-xs text-slate-500">Envio automático de lembretes e tarefas pós-sessão</p>
                </div>
              </div>
              <span
                className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${
                  settings.evolutionApi.connectionStatus === 'connected'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {settings.evolutionApi.connectionStatus === 'connected' ? 'CONECTADO' : 'DESCONECTADO'}
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">URL da Instância Evolution API</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="https://api.evolution.sua-clinica.com"
                    value={settings.evolutionApi.baseUrl}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        evolutionApi: { ...settings.evolutionApi, baseUrl: e.target.value },
                      })
                    }
                    className="w-full text-xs font-mono p-3 pl-9 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">API Key Evolution</label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="evo_key_..."
                    value={settings.evolutionApi.apiKey}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        evolutionApi: { ...settings.evolutionApi, apiKey: e.target.value },
                      })
                    }
                    className="w-full text-xs font-mono p-3 pl-9 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                  />
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                </div>
              </div>
            </div>
          </div>

          {qrCodeGenerated ? (
            <div className="p-4 bg-slate-900 rounded-2xl text-center space-y-3">
              <div className="w-32 h-32 bg-white rounded-xl mx-auto flex items-center justify-center p-2 border-2 border-emerald-400">
                <QrCode className="w-24 h-24 text-slate-900" />
              </div>
              <p className="text-[11px] text-slate-300">Escaneie o QR Code com o WhatsApp da sua clínica</p>
              <button
                onClick={handleSimulateScanQrCode}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs"
              >
                Simular Leitura do QR Code
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectEvolution}
              disabled={isConnectingEvolution || !settings.evolutionApi.apiKey}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-2 transition-all shadow-md shadow-emerald-600/20"
            >
              {isConnectingEvolution ? <RefreshCw className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
              <span>Gerar QR Code WhatsApp</span>
            </button>
          )}
        </div>
      </div>

      <NfseIntegrationCard />
    </div>
  );
}

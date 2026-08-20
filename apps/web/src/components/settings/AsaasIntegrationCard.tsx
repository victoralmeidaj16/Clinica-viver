'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, CreditCard, RefreshCw, ShieldCheck, Webhook } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';

interface AsaasStatus {
  configured: boolean;
  environment: 'production' | 'sandbox' | 'unknown';
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

export function AsaasIntegrationCard() {
  const [status, setStatus] = useState<AsaasStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await applicationRequest<AsaasStatus>('/integrations/asaas'));
    } catch (cause) {
      setStatus(null);
      setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o Asaas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void applicationRequest<AsaasStatus>('/integrations/asaas').then(
      (result) => {
        if (!active) return;
        setStatus(result);
        setLoading(false);
      },
      (cause) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'Não foi possível consultar o Asaas.');
        setLoading(false);
      }
    );
    return () => { active = false; };
  }, []);

  const production = status?.environment === 'production';
  const operational = status?.ready === true && production;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-blue-600">
            <CreditCard className="h-6 w-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Asaas (Cobranças e Pix)</h3>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                operational ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
              }`}>
                {loading ? 'VERIFICANDO' : operational ? 'PRODUÇÃO ATIVA' : 'AÇÃO NECESSÁRIA'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Credenciais ficam somente na VPS; esta tela exibe um diagnóstico seguro da operação.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-extrabold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="mt-4 flex gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {status && (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <StatusItem
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Ambiente"
              value={production ? 'Produção (dinheiro real)' : status.environment === 'sandbox' ? 'Sandbox' : 'Configuração inválida'}
              ok={production}
            />
            <StatusItem
              icon={<CreditCard className="h-4 w-4" />}
              label="API e credenciais"
              value={status.credentialsValid ? 'Conexão autenticada' : 'Não autenticada'}
              ok={status.apiReachable && status.credentialsValid}
            />
            <StatusItem
              icon={<Webhook className="h-4 w-4" />}
              label="Conciliação"
              value={status.webhook.enabled && !status.webhook.interrupted ? 'Webhook ativo' : 'Webhook indisponível'}
              ok={status.webhook.configured && status.webhook.enabled && !status.webhook.interrupted}
            />
          </div>

          {operational && (
            <p className="mt-4 flex gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Cobranças reais e baixa automática por PAYMENT_CONFIRMED/PAYMENT_RECEIVED estão habilitadas.
            </p>
          )}

          {status.issues.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 rounded-2xl border border-amber-200 bg-amber-50 p-4 pl-8 text-xs text-amber-900">
              {status.issues.map((issue) => <li key={issue}>{issue}</li>)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function StatusItem({ icon, label, value, ok }: { icon: ReactNode; label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">{icon}{label}</p>
      <p className={`mt-2 text-xs font-extrabold ${ok ? 'text-emerald-700' : 'text-amber-800'}`}>{value}</p>
    </div>
  );
}

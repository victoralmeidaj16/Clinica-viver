'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  CreditCard,
  QrCode,
  Copy,
  CheckCircle2,
  Lock,
  Sparkles,
  ShieldCheck,
  Building2,
  Clock,
  Check,
  ArrowLeft,
} from 'lucide-react';

export default function CheckoutLinkUnicoPage() {
  const params = useParams();
  const idCobranca = params?.id ? String(params.id) : 'PAY-89312';

  // Modalidade e Valor Dinâmicos com base no código do ID
  const isParticular = idCobranca.toLowerCase().includes('part') || idCobranca.toLowerCase().includes('130');
  const valorSessao = isParticular ? 130.00 : 75.00;
  const modalidadeNome = isParticular ? 'Sessão Individual (Particular)' : 'Atendimento Acessível (Social)';

  const [metodo, setMetodo] = useState<'pix' | 'cartao'>('pix');
  const [copiado, setCopiado] = useState(false);
  const [pago, setPago] = useState(false);

  // Timer de Vencimento de 15 minutos do Pix
  const [timeLeft, setTimeLeft] = useState(15 * 60);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const pixCode = `00020126580014BR.GOV.BCB.PIX0136vivermais-${idCobranca}520400005303986540${valorSessao.toFixed(2)}5802BR`;

  const handleCopiarPix = () => {
    navigator.clipboard.writeText(pixCode);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 3000);
  };

  const handleSimularPagamentoWebhook = async () => {
    setPago(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 sm:p-8 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">
        {/* Header Branding Viver Mais */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1 rounded-full text-emerald-400 text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />
            Pagamento Seguro Viver Mais (Asaas)
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Checkout de Atendimento
          </h1>
          <p className="text-xs text-slate-400">
            Código da Cobrança: <span className="font-mono text-emerald-400 font-bold">#{idCobranca}</span>
          </p>
        </div>

        {pago ? (
          <div className="bg-gradient-to-br from-emerald-900 to-slate-900 border border-emerald-500/40 rounded-3xl p-8 text-center space-y-4 shadow-contrast">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-white">Pagamento Confirmado!</h2>
            <p className="text-xs text-slate-300">
              Obrigado! Seu pagamento de <strong className="text-emerald-400">R$ {valorSessao.toFixed(2)}</strong> foi conciliado automaticamente via Webhook. O psicólogo já foi notificado.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-xs text-slate-400 font-mono space-y-1">
              <p>Nota Fiscal Eletrônica será enviada no e-mail cadastrado.</p>
              <p className="text-emerald-400 font-bold text-[11px]">Resguardo Jurídico & Sigilo Garantidos (CFP/LGPD)</p>
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
            {/* Detalhes da Consulta com Valor Dinâmico */}
            <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Atendimento Psicologia</span>
                <span className="text-sm font-black text-white">{modalidadeNome}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Valor Total</span>
                <span className="text-xl font-black text-emerald-400">R$ {valorSessao.toFixed(2)}</span>
              </div>
            </div>

            {/* Alternar Método (Pix vs Cartão) */}
            <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800">
              <button
                type="button"
                onClick={() => setMetodo('pix')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  metodo === 'pix' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <QrCode className="w-4 h-4" />
                Pix Dynamic (Instantâneo)
              </button>
              <button
                type="button"
                onClick={() => setMetodo('cartao')}
                className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                  metodo === 'cartao' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                }`}
              >
                <CreditCard className="w-4 h-4" />
                Cartão de Crédito
              </button>
            </div>

            {metodo === 'pix' ? (
              <div className="space-y-4 text-center">
                {/* Timer de Vencimento */}
                <div className="inline-flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/30">
                  <Clock className="w-3.5 h-3.5 animate-pulse" />
                  <span>Este QR Code expira em <strong className="font-mono">{formatTimer(timeLeft)}</strong></span>
                </div>

                {/* QR Code gerado */}
                <div className="bg-white p-4 rounded-2xl inline-block border border-slate-700 shadow-md">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(pixCode)}`}
                    alt="QR Code Pix"
                    className="w-44 h-44 mx-auto"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400">Ou copie a chave Pix abaixo e pague no seu aplicativo do banco:</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={pixCode}
                      className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-[10px] font-mono text-slate-300 w-full truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopiarPix}
                      className="bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-bold text-xs px-3.5 py-2.5 rounded-xl transition-all flex items-center gap-1 shrink-0"
                    >
                      {copiado ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiado ? 'Copiado!' : 'Copiar'}
                    </button>
                  </div>
                </div>

                {/* Botão de simular aprovação do Webhook */}
                <button
                  type="button"
                  onClick={handleSimularPagamentoWebhook}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 text-xs font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Simular Webhook de Aprovação Instantânea
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1 font-semibold">Número do Cartão</label>
                  <input
                    type="text"
                    placeholder="0000 0000 0000 0000"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-semibold">Validade</label>
                    <input
                      type="text"
                      placeholder="MM/AA"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-semibold">CVV</label>
                    <input
                      type="text"
                      placeholder="123"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSimularPagamentoWebhook}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs py-3.5 rounded-2xl shadow-lg shadow-emerald-500/30 transition-all mt-2"
                >
                  PAGAR R$ {valorSessao.toFixed(2)} NO CARTÃO
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

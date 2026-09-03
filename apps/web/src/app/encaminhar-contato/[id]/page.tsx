'use client';

import React, { useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, ArrowRightLeft } from 'lucide-react';
import Link from 'next/link';

type Situacao =
  | { estado: 'CONFIRMACAO_PENDENTE' }
  | { estado: 'ENVIANDO' }
  | { estado: 'ENCAMINHADO'; mensagem: string }
  | { estado: 'ERRO'; mensagem: string };

export default function EncaminharContatoPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const psi = searchParams.get('psi');
  const token = searchParams.get('t');
  const leadId = params?.id;

  const linkCompleto = Boolean(leadId && psi && token);

  const [situacao, setSituacao] = useState<Situacao>(
    linkCompleto
      ? { estado: 'CONFIRMACAO_PENDENTE' }
      : {
          estado: 'ERRO',
          mensagem: 'Link incompleto. Abra o link exatamente como recebeu na notificação.',
        }
  );

  const executarEncaminhamento = async () => {
    if (!linkCompleto) return;
    setSituacao({ estado: 'ENVIANDO' });

    try {
      const resposta = await fetch(
        `/api/application/triagem/${leadId}/encaminhar?psi=${encodeURIComponent(psi ?? '')}&t=${encodeURIComponent(token ?? '')}`,
        { method: 'POST' }
      );
      const corpo = await resposta.json();

      if (corpo.success) {
        setSituacao({
          estado: 'ENCAMINHADO',
          mensagem: corpo.message || 'Atendimento encaminhado com sucesso ao próximo profissional.',
        });
      } else {
        setSituacao({
          estado: 'ERRO',
          mensagem: corpo.error || 'Não foi possível processar o encaminhamento.',
        });
      }
    } catch {
      setSituacao({
        estado: 'ERRO',
        mensagem: 'Falha de conexão com o servidor. Tente novamente em instantes.',
      });
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-md w-full p-8 space-y-5 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
          Viver Mais Psicologia
        </p>

        {situacao.estado === 'CONFIRMACAO_PENDENTE' && (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <ArrowRightLeft className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-black text-slate-900">Encaminhar Atendimento?</h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              Caso você não tenha disponibilidade de horários no momento, confirme abaixo para repassar este paciente
              imediatamente ao próximo profissional compatível da fila.
            </p>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={executarEncaminhamento}
                className="w-full py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm transition-colors shadow-sm"
              >
                Sim, Encaminhar para a Fila
              </button>
              <Link
                href="/cockpit"
                className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium text-xs transition-colors inline-block"
              >
                Cancelar e Ir para o Cockpit
              </Link>
            </div>
          </div>
        )}

        {situacao.estado === 'ENVIANDO' && (
          <div className="space-y-3 py-4">
            <Loader2 className="w-10 h-10 text-purple-600 mx-auto animate-spin" />
            <h1 className="text-lg font-black text-slate-900">Encaminhando paciente…</h1>
            <p className="text-xs text-slate-500">Localizando o próximo profissional elegível.</p>
          </div>
        )}

        {situacao.estado === 'ENCAMINHADO' && (
          <div className="space-y-3">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h1 className="text-lg font-black text-slate-900">Atendimento Encaminhado!</h1>
            <p className="text-sm text-slate-600">{situacao.mensagem}</p>
            <p className="text-xs text-slate-500">
              O paciente foi retirado de suas pendências e o prazo de 24 horas não corre mais para você.
            </p>
            <div className="pt-3">
              <Link
                href="/cockpit"
                className="inline-block py-2.5 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-colors"
              >
                Ir para o Cockpit
              </Link>
            </div>
          </div>
        )}

        {situacao.estado === 'ERRO' && (
          <div className="space-y-3">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h1 className="text-lg font-black text-slate-900">Não foi possível encaminhar</h1>
            <p className="text-sm text-slate-600">{situacao.mensagem}</p>
            <p className="text-xs text-slate-500">
              Se o prazo de 24 horas já expirou ou o paciente já foi confirmado, nenhuma ação adicional é necessária.
            </p>
            <div className="pt-3">
              <Link
                href="/cockpit"
                className="inline-block py-2.5 px-5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors"
              >
                Acessar o Cockpit
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * Página do link que o psicólogo recebe no WhatsApp.
 *
 * Pública e mínima de propósito: quem chega aqui veio de uma conversa, não de
 * um login, e a única coisa que precisa fazer é dizer que já falou com a
 * pessoa. Nenhum dado clínico aparece — só o nome de quem procurou a clínica e
 * o contato que o profissional já tem na própria mensagem.
 */

interface Confirmacao {
  nomePaciente: string;
  telefone: string;
  confirmadoEm: string;
}

type Situacao =
  | { estado: 'ENVIANDO' }
  | { estado: 'CONFIRMADO'; dados: Confirmacao; jaEstava: boolean }
  | { estado: 'ERRO'; mensagem: string };

const LINK_INCOMPLETO: Situacao = {
  estado: 'ERRO',
  mensagem: 'Link incompleto. Abra o link exatamente como recebeu na mensagem.',
};

export default function ConfirmarContatoPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const psi = searchParams.get('psi');
  const token = searchParams.get('t');
  const leadId = params?.id;

  // Link truncado é conclusão do próprio endereço, não resultado de chamada:
  // derivar em vez de gravar em estado evita um render só para dizer o que já
  // se sabia antes de renderizar.
  const linkCompleto = Boolean(leadId && psi && token);

  const [situacao, setSituacao] = useState<Situacao>(
    linkCompleto ? { estado: 'ENVIANDO' } : LINK_INCOMPLETO
  );

  const confirmar = useCallback(async () => {
    try {
      const resposta = await fetch(
        `/api/application/triagem/${leadId}/confirmar?psi=${encodeURIComponent(psi ?? '')}&t=${encodeURIComponent(token ?? '')}`,
        { method: 'POST' }
      );
      const corpo = await resposta.json();

      if (corpo.success) {
        setSituacao({ estado: 'CONFIRMADO', dados: corpo.data, jaEstava: Boolean(corpo.jaConfirmado) });
      } else {
        setSituacao({ estado: 'ERRO', mensagem: corpo.error ?? 'Não foi possível confirmar.' });
      }
    } catch {
      setSituacao({ estado: 'ERRO', mensagem: 'Falha de conexão. Tente abrir o link novamente.' });
    }
  }, [leadId, psi, token]);

  // Confirmação em microtask: o `setState` do resultado precisa cair depois do
  // render, não dentro dele.
  useEffect(() => {
    if (!linkCompleto) return;
    void Promise.resolve().then(confirmar);
  }, [confirmar, linkCompleto]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-lg max-w-md w-full p-8 space-y-4 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">
          Viver Mais Psicologia
        </p>

        {situacao.estado === 'ENVIANDO' && (
          <>
            <Loader2 className="w-10 h-10 text-purple-600 mx-auto animate-spin" />
            <h1 className="text-lg font-black text-slate-900">Registrando sua confirmação…</h1>
          </>
        )}

        {situacao.estado === 'CONFIRMADO' && (
          <>
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
            <h1 className="text-lg font-black text-slate-900">
              {situacao.jaEstava ? 'Contato já confirmado' : 'Contato confirmado!'}
            </h1>
            <p className="text-sm text-slate-600">
              O atendimento de <strong className="text-slate-900">{situacao.dados.nomePaciente}</strong> está
              vinculado a você. O prazo de 24 horas não corre mais para este paciente.
            </p>
            <p className="text-xs text-slate-500">WhatsApp do paciente: {situacao.dados.telefone}</p>
          </>
        )}

        {situacao.estado === 'ERRO' && (
          <>
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
            <h1 className="text-lg font-black text-slate-900">Não foi possível confirmar</h1>
            <p className="text-sm text-slate-600">{situacao.mensagem}</p>
            <p className="text-xs text-slate-500">
              Se o prazo de 24 horas passou, o paciente já foi encaminhado ao próximo profissional da
              fila. Fale com a gestão da clínica em caso de dúvida.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

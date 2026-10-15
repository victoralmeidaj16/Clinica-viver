'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowRightLeft, CheckCircle2, Clock3, HeartHandshake, Loader2 } from 'lucide-react';

type Estado = 'CARREGANDO' | 'DECISAO' | 'PERGUNTA_CONTATO' | 'AVISO_24H' | 'ENVIANDO' | 'CONFIRMADO' | 'ENCAMINHADO' | 'ERRO';

export default function ConfirmarContatoPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const leadId = params?.id;
  const psi = searchParams.get('psi');
  const token = searchParams.get('t');
  const linkCompleto = Boolean(leadId && psi && token);
  const [estado, setEstado] = useState<Estado>(linkCompleto ? 'CARREGANDO' : 'ERRO');
  const [mensagem, setMensagem] = useState(linkCompleto ? '' : 'Link incompleto. Abra exatamente o endereço recebido na mensagem.');

  const endpoint = useCallback((acao: 'decisao' | 'confirmar' | 'encaminhar') =>
    `/api/application/triagem/${leadId}/${acao}?psi=${encodeURIComponent(psi ?? '')}&t=${encodeURIComponent(token ?? '')}`,
  [leadId, psi, token]);

  useEffect(() => {
    if (!linkCompleto) return;
    let ativo = true;
    fetch(endpoint('decisao'), { cache: 'no-store' })
      .then(async (resposta) => {
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error || 'Não foi possível abrir este encaminhamento.');
        if (!ativo) return;
        setEstado(corpo.estado === 'CONFIRMADO' ? 'CONFIRMADO' : corpo.estado === 'ACEITO' ? 'PERGUNTA_CONTATO' : 'DECISAO');
      })
      .catch((erro: Error) => {
        if (!ativo) return;
        setMensagem(erro.message);
        setEstado('ERRO');
      });
    return () => { ativo = false; };
  }, [endpoint, linkCompleto]);

  const executar = async (acao: 'decisao' | 'confirmar' | 'encaminhar') => {
    setEstado('ENVIANDO');
    try {
      const resposta = await fetch(endpoint(acao), { method: 'POST' });
      const corpo = await resposta.json();
      if (!resposta.ok || !corpo.success) throw new Error(corpo.error || 'Não foi possível registrar sua resposta.');
      if (acao === 'decisao') setEstado(corpo.estado === 'CONFIRMADO' ? 'CONFIRMADO' : 'PERGUNTA_CONTATO');
      if (acao === 'confirmar') setEstado('CONFIRMADO');
      if (acao === 'encaminhar') {
        setMensagem(corpo.message || 'Paciente encaminhado ao próximo profissional da fila.');
        setEstado('ENCAMINHADO');
      }
    } catch (erro) {
      setMensagem(erro instanceof Error ? erro.message : 'Falha de conexão. Tente novamente.');
      setEstado('ERRO');
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-lg">
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-purple-700">Viver Mais Psicologia</p>

        {(estado === 'CARREGANDO' || estado === 'ENVIANDO') && <>
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-purple-600" />
          <h1 className="text-lg font-black text-slate-900">{estado === 'CARREGANDO' ? 'Carregando encaminhamento…' : 'Registrando sua resposta…'}</h1>
        </>}

        {estado === 'DECISAO' && <>
          <HeartHandshake className="mx-auto h-12 w-12 text-purple-700" />
          <h1 className="text-xl font-black text-slate-900">Deseja atender este paciente?</h1>
          <p className="text-sm leading-relaxed text-slate-600">Registre sua decisão para que a clínica dê continuidade ao encaminhamento.</p>
          <div className="flex flex-col gap-3 pt-2">
            <button type="button" onClick={() => void executar('decisao')} className="w-full rounded-xl bg-purple-700 px-4 py-3 text-sm font-extrabold text-white transition-colors hover:bg-purple-800">QUERO O PACIENTE</button>
            <button type="button" onClick={() => void executar('encaminhar')} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-extrabold text-slate-700 transition-colors hover:bg-slate-50"><ArrowRightLeft className="h-4 w-4" /> ENCAMINHAR PARA COLEGA</button>
          </div>
        </>}

        {estado === 'PERGUNTA_CONTATO' && <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="text-xl font-black text-slate-900">Você já chamou este paciente?</h1>
          <p className="text-sm leading-relaxed text-slate-600">O paciente já está vinculado a você como responsável.</p>
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button type="button" onClick={() => void executar('confirmar')} className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-extrabold text-white hover:bg-emerald-700">SIM</button>
            <button type="button" onClick={() => setEstado('AVISO_24H')} className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-extrabold text-slate-700 hover:bg-slate-50">NÃO</button>
          </div>
        </>}

        {estado === 'AVISO_24H' && <>
          <Clock3 className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="text-xl font-black text-slate-900">Entre em contato em até 24 horas</h1>
          <p className="text-sm leading-relaxed text-slate-600">O prazo continua contando desde o encaminhamento original. Assim que falar com o paciente, abra este mesmo link novamente e marque <strong>SIM</strong>.</p>
        </>}

        {estado === 'CONFIRMADO' && <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="text-xl font-black text-slate-900">Contato confirmado!</h1>
          <p className="text-sm text-slate-600">O primeiro contato foi registrado e o encaminhamento consta como concluído na fila de espera.</p>
        </>}

        {estado === 'ENCAMINHADO' && <>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="text-xl font-black text-slate-900">Paciente encaminhado</h1>
          <p className="text-sm text-slate-600">{mensagem}</p>
        </>}

        {estado === 'ERRO' && <>
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="text-xl font-black text-slate-900">Não foi possível continuar</h1>
          <p className="text-sm text-slate-600">{mensagem}</p>
        </>}
      </div>
    </main>
  );
}

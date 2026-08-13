'use client';

import React, { useState, use } from 'react';
import { notFound } from 'next/navigation';
import {
  QrCode,
  Copy,
  CreditCard,
  User,
  Phone,
  FileText,
  HeartHandshake,
  Sparkles,
  ArrowRight,
  Loader2,
  Check,
} from 'lucide-react';
import {
  modalidadePorSlug,
  nomeDoSlug,
  reaisDeCentavos,
} from '@/lib/modalidadesPagamento';

/**
 * Checkout de uma modalidade.
 *
 * O valor não é escolhido aqui: ele vem do endereço, e o paciente só confirma
 * quem é. Era o oposto antes — um link só, com dois botões de preço —, e o
 * psicólogo que combinou o valor social por WhatsApp não tinha como impedir que
 * a sessão fosse paga como particular, ou o contrário.
 */

interface Props {
  params: Promise<{ slug: string; modalidade: string }>;
}

interface CobrancaGerada {
  pixQrCode?: string;
  pixCopiaECola?: string;
  invoiceUrl?: string;
  cobrancaId?: string;
  valor?: number;
}

export default function PagamentoModalidadePage({ params }: Props) {
  const { slug, modalidade: modalidadeSlug } = use(params);

  const [nome, setNome] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cpf, setCpf] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [resultado, setResultado] = useState<CobrancaGerada | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const modalidade = modalidadePorSlug(modalidadeSlug);

  // Um endereço inventado não vira uma cobrança de valor arbitrário: sem
  // modalidade conhecida não há preço, e a página simplesmente não existe.
  if (!modalidade) notFound();

  const nomeProfissional = nomeDoSlug(slug);

  const gerarPagamento = async (evento: React.FormEvent) => {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);

    try {
      const resposta = await fetch('/api/pagamento/gerar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          psicologoId: slug,
          psicologoNome: nomeProfissional,
          // O preço fica de fora de propósito: quem o define é a rota, a partir
          // desta modalidade.
          modalidade: modalidade.slug,
          pacienteNome: nome,
          pacienteCpf: cpf,
          pacienteWhatsapp: whatsapp,
        }),
      });

      const dados = await resposta.json();
      if (!resposta.ok || dados.error) {
        throw new Error(dados.error || 'Não foi possível gerar a cobrança.');
      }

      setResultado(dados);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Ocorreu um erro ao processar o pagamento.');
    } finally {
      setCarregando(false);
    }
  };

  const copiarPix = () => {
    if (!resultado?.pixCopiaECola) return;
    void navigator.clipboard.writeText(resultado.pixCopiaECola);
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 3000);
  };

  return (
    <>
      {/* Perfil do psicólogo */}
      <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-6 shadow-2xl relative overflow-hidden mb-6">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-700 border-2 border-emerald-500/30 flex items-center justify-center text-slate-300 font-bold text-xl shadow-inner relative">
            <User className="w-8 h-8 text-emerald-400" />
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-slate-800 flex items-center justify-center">
              <Check className="w-3 h-3 text-slate-950 font-black" />
            </div>
          </div>

          <div>
            <span className="text-[10px] font-extrabold tracking-widest text-emerald-400 uppercase">
              Profissional Habilitado
            </span>
            <h1 className="text-xl font-black text-white">{nomeProfissional}</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">Atendimento Clínico</p>
          </div>
        </div>
      </div>

      {!resultado ? (
        <form
          onSubmit={gerarPagamento}
          className="bg-slate-800/60 border border-slate-700/60 rounded-3xl p-6 space-y-5 shadow-xl"
        >
          <div>
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <HeartHandshake className="w-5 h-5 text-emerald-400" />
              Pagamento da Consulta
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Preencha seus dados abaixo para gerar o código Pix ou pagar no cartão de crédito.
            </p>
          </div>

          {erro && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
              ⚠️ {erro}
            </div>
          )}

          {/* Valor da sessão: informado, não escolhido */}
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider block text-emerald-400 mb-0.5">
                {modalidade.rotulo}
              </span>
              <span className="text-2xl font-black text-white">
                {reaisDeCentavos(modalidade.valorCentavos)}
              </span>
              <p className="text-[11px] text-slate-400 mt-0.5">{modalidade.descricao}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <Check className="w-5 h-5 text-emerald-400" />
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1" htmlFor="paciente-nome">
                Seu Nome Completo *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  id="paciente-nome"
                  type="text"
                  required
                  placeholder="Nome completo"
                  value={nome}
                  onChange={(evento) => setNome(evento.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1" htmlFor="paciente-whatsapp">
                  WhatsApp *
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="paciente-whatsapp"
                    type="tel"
                    required
                    placeholder="(00) 00000-0000"
                    value={whatsapp}
                    onChange={(evento) => setWhatsapp(evento.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1" htmlFor="paciente-cpf">
                  CPF *
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    id="paciente-cpf"
                    type="text"
                    required
                    placeholder="000.000.000-00"
                    value={cpf}
                    onChange={(evento) => setCpf(evento.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm rounded-2xl shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 cursor-pointer"
          >
            {carregando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Gerando cobrança segura…
              </>
            ) : (
              <>
                Pagar {reaisDeCentavos(modalidade.valorCentavos)}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-slate-800/80 border border-slate-700 rounded-3xl p-6 space-y-6 shadow-2xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-extrabold">
            <Sparkles className="w-4 h-4" />
            Cobrança gerada com sucesso
          </div>

          <div>
            <span className="text-xs text-slate-400 font-semibold block">Valor a pagar:</span>
            <span className="text-3xl font-black text-white">
              {reaisDeCentavos(
                resultado.valor ? Math.round(resultado.valor * 100) : modalidade.valorCentavos
              )}
            </span>
            <span className="text-[11px] text-slate-400 block mt-1">{modalidade.rotulo}</span>
          </div>

          {resultado.pixQrCode && (
            <div className="bg-white p-4 rounded-3xl inline-block shadow-xl border-4 border-emerald-500/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resultado.pixQrCode}
                alt="QR Code Pix da cobrança"
                className="w-48 h-48 mx-auto object-contain"
              />
            </div>
          )}

          {resultado.pixCopiaECola && (
            <div className="space-y-2 text-left">
              <label className="text-xs font-bold text-slate-300 block" htmlFor="pix-copia-cola">
                Pix Copia e Cola:
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="pix-copia-cola"
                  type="text"
                  readOnly
                  value={resultado.pixCopiaECola}
                  className="w-full bg-slate-900 border border-slate-700 rounded-2xl py-2.5 px-3 text-[11px] text-slate-300 font-mono truncate focus:outline-none"
                />
                <button
                  type="button"
                  onClick={copiarPix}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-4 py-2.5 rounded-2xl transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-emerald-500/20"
                >
                  {copiado ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {resultado.invoiceUrl && (
            <div className="pt-2 border-t border-slate-700/60">
              <a
                href={resultado.invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3.5 bg-slate-700/80 hover:bg-slate-700 text-white font-extrabold text-xs rounded-2xl border border-slate-600 transition-all flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4 text-emerald-400" />
                Pagar com cartão de crédito / outras formas
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={() => setResultado(null)}
            className="text-xs text-slate-400 hover:text-slate-200 underline block mx-auto font-medium"
          >
            ← Gerar outro pagamento
          </button>
        </div>
      )}

      <p className="mt-6 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
        <QrCode className="w-3.5 h-3.5" />
        Link exclusivo de {nomeProfissional} · {modalidade.rotulo}
      </p>
    </>
  );
}

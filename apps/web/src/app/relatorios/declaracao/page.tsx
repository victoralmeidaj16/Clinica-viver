'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Award, Loader2, Printer, ShieldCheck } from 'lucide-react';
import { DocumentoDeclaracao } from '@/components/declaracao/DocumentoDeclaracao';
import './declaracao.css';

/**
 * Emissor da declaração de horas de atendimento.
 *
 * O que mudou, e por quê: esta tela tinha o total de horas num `input` e o
 * nome, o CRP e o curso em campos de texto livre, todos já preenchidos com um
 * exemplo. Dava para imprimir, sem má-fé nenhuma, a declaração de uma pessoa
 * com o curso de outra e um total digitado — e o documento saía com a mesma
 * aparência de um emitido corretamente.
 *
 * Agora nada é digitado. O psicólogo é escolhido do cadastro, o resto vem do
 * servidor, e o papel só existe **depois** da emissão registrada.
 *
 * O documento não carrega mais código de conferência nem QR: o relatório de
 * estágio vale pelas assinaturas da coordenação e da supervisão, e a validação
 * pública por código ficou restrita aos certificados do painel de certificados.
 * A emissão continua gravada — o que se perdeu foi a conferência de fora, não o
 * registro de dentro.
 */

interface PsicologoElegivel {
  id: string;
  nome: string;
  crp: string;
  curso?: string;
  impedimento?: string;
}

interface Previa {
  psicologoNome: string;
  psicologoCrp: string;
  /** "Pós-Graduanda" ou "Pós-Graduando": concordância vinda do cadastro. */
  tratamento: string;
  curso: string;
  periodoInicio: string;
  periodoFim: string;
  totalSessoes: number;
  totalHoras: number;
  coordenadora: string;
  supervisora: string;
}

interface Emitida extends Previa {
  emitidoEm: string;
}

function mesAno(iso: string): string {
  const rotulo = new Date(`${iso}T12:00:00Z`).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return rotulo.charAt(0).toUpperCase() + rotulo.slice(1);
}

async function mensagemDeErro(resposta: Response): Promise<string> {
  try {
    const corpo = (await resposta.json()) as { error?: { message?: string } };
    return corpo.error?.message || 'Não foi possível concluir a operação.';
  } catch {
    return 'Não foi possível concluir a operação.';
  }
}

export default function DeclaracaoHorasPage() {
  const [psicologos, setPsicologos] = useState<PsicologoElegivel[]>([]);
  const [carregandoLista, setCarregandoLista] = useState(true);
  const [selecionado, setSelecionado] = useState('');
  const [previa, setPrevia] = useState<Previa>();
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [emitida, setEmitida] = useState<Emitida>();
  const [emitindo, setEmitindo] = useState(false);
  const [erro, setErro] = useState<string>();

  useEffect(() => {
    fetch('/api/application/declaracao-horas')
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
        const corpo = (await resposta.json()) as { data: { psicologos: PsicologoElegivel[] } };
        setPsicologos(corpo.data.psicologos);
      })
      .catch((causa: Error) => setErro(causa.message))
      .finally(() => setCarregandoLista(false));
  }, []);

  useEffect(() => {
    if (!selecionado) return;

    let ativo = true;

    fetch(`/api/application/declaracao-horas?psicologoId=${encodeURIComponent(selecionado)}`)
      .then(async (resposta) => {
        if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
        const corpo = (await resposta.json()) as { data: Previa };
        if (ativo) setPrevia(corpo.data);
      })
      .catch((causa: Error) => {
        if (ativo) setErro(causa.message);
      })
      .finally(() => {
        if (ativo) setCarregandoPrevia(false);
      });

    return () => {
      ativo = false;
    };
  }, [selecionado]);

  async function emitir() {
    setEmitindo(true);
    setErro(undefined);
    try {
      const resposta = await fetch('/api/application/declaracao-horas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ psicologoId: selecionado }),
      });
      if (!resposta.ok) throw new Error(await mensagemDeErro(resposta));
      const corpo = (await resposta.json()) as { data: Emitida };
      setEmitida(corpo.data);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível emitir a declaração.');
    } finally {
      setEmitindo(false);
    }
  }

  /**
   * Trocar de psicólogo descarta o que estava na tela.
   *
   * A limpeza acontece aqui, no evento, e não num efeito que observa a
   * seleção: deixar a declaração emitida visível ao lado do nome de outra
   * pessoa é exatamente o erro que esta reescrita existe para impedir, e o
   * evento é o momento exato em que a troca acontece.
   */
  function selecionar(psicologoId: string) {
    setSelecionado(psicologoId);
    setPrevia(undefined);
    setEmitida(undefined);
    setErro(undefined);
    // O "carregando" começa junto com a escolha, e não dentro do efeito: a
    // busca é consequência da seleção, e marcá-lo aqui evita o render extra.
    setCarregandoPrevia(Boolean(psicologoId));
  }

  const escolhido = psicologos.find((psi) => psi.id === selecionado);

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 text-slate-800 font-sans print:p-0 print:bg-white">
      {/* Painel de controle — não vai para o papel. */}
      <div className="max-w-4xl mx-auto mb-8 bg-white p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden">
        <div className="flex flex-wrap gap-4 items-center justify-between border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-purple-100 rounded-xl text-purple-800">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Relatório de Estágio — Horas de Atendimento
              </h1>
              <p className="text-xs text-slate-500">
                O total vem das sessões registradas. Cada emissão fica registrada para a clínica, com quem
                emitiu e o que foi declarado.
              </p>
            </div>
          </div>

          {emitida && (
            <button
              onClick={() => window.print()}
              className="flex items-center space-x-2 px-5 py-2.5 bg-purple-800 hover:bg-purple-900 text-white font-semibold rounded-xl transition-all shadow-md shadow-purple-900/10"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="psicologo" className="block text-xs font-medium text-slate-700 mb-1">
              Psicólogo(a)
            </label>
            <select
              id="psicologo"
              value={selecionado}
              onChange={(evento) => selecionar(evento.target.value)}
              disabled={carregandoLista}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-600 disabled:bg-slate-50"
            >
              <option value="">
                {carregandoLista ? 'Carregando cadastros…' : 'Selecione quem receberá a declaração'}
              </option>
              {psicologos.map((psi) => (
                <option key={psi.id} value={psi.id} disabled={Boolean(psi.impedimento)}>
                  {psi.nome} — CRP {psi.crp}
                  {psi.impedimento ? ` (${psi.impedimento})` : ''}
                </option>
              ))}
            </select>
          </div>

          {escolhido?.impedimento && (
            <p className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {escolhido.impedimento}
            </p>
          )}

          {erro && (
            <p className="flex items-start gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              {erro}
            </p>
          )}

          {carregandoPrevia && (
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              Apurando as horas registradas…
            </p>
          )}

          {previa && !emitida && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <p className="text-xs text-slate-600">
                Serão declaradas <strong className="text-slate-900">{previa.totalHoras} horas</strong> —{' '}
                {previa.totalSessoes} {previa.totalSessoes === 1 ? 'atendimento realizado' : 'atendimentos realizados'} entre{' '}
                {mesAno(previa.periodoInicio)} e {mesAno(previa.periodoFim)}.
              </p>
              <button
                onClick={emitir}
                disabled={emitindo}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-800 hover:bg-purple-900 disabled:opacity-60 text-white font-semibold text-sm rounded-xl transition-all shadow-md shadow-purple-900/10"
              >
                {emitindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                {emitindo ? 'Emitindo…' : 'Emitir declaração'}
              </button>
            </div>
          )}

          {emitida && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Relatório emitido
              </p>
              <p className="text-[11px] text-emerald-800 mt-1">
                {emitida.totalHoras} horas registradas para {emitida.psicologoNome}. Use o botão acima
                para imprimir ou salvar em PDF.
              </p>
            </div>
          )}
        </div>
      </div>


      {/* O documento A4 só existe depois de emitido. O papel não traz mais
          código de conferência, mas a emissão continua sendo gravada: é ela
          que amarra o total impresso às sessões que o produziram. */}
      {emitida && <DocumentoDeclaracao declaracao={emitida} />}
    </div>
  );
}

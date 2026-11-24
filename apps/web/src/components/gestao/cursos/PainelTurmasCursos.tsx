'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { formatarDataCurta } from '@/lib/turmaEncerrada';
import {
  ROTULO_SITUACAO_TURMA,
  rotuloRestante,
  type AvisosTurma,
  type PrazoSaidaTurma,
  type SituacaoTurma,
  type TurmaRegistro,
} from '@/lib/turmasCiclo';
import { recarregarCatalogoCursos, useCatalogoCursos, cursosParaSelecao } from '@/components/forms/useCatalogoCursos';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';
import { AcoesTurma } from './AcoesTurma';
import { ConfigSaidaTurmas } from './ConfigSaidaTurmas';

interface TurmaParaGestao extends TurmaRegistro {
  situacao: SituacaoTurma;
  saidaEm?: string;
  diasRestantes?: number;
  psicologos: { id: string; nome: string; papel: 'PRINCIPAL' | 'SEGUNDA'; aprovado: boolean }[];
}

interface PainelTurmasDados {
  turmas: TurmaParaGestao[];
  prazo: PrazoSaidaTurma;
  avisos: AvisosTurma;
  cadastroDisponivel: boolean;
}

const COR_SITUACAO: Record<SituacaoTurma, string> = {
  ABERTA: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  EM_SAIDA: 'border-amber-200 bg-amber-50 text-amber-800',
  SAIDA_INTERROMPIDA: 'border-sky-200 bg-sky-50 text-sky-800',
  DESLIGADA: 'border-slate-300 bg-slate-100 text-slate-700',
};

/** Turmas por curso com o ciclo de encerramento (1.01–1.05). */
export function PainelTurmasCursos() {
  const catalogo = useCatalogoCursos();
  const [dados, setDados] = useState<PainelTurmasDados | null>(null);
  const [erro, setErro] = useState<string>();
  const [curso, setCurso] = useState('');
  const [codigo, setCodigo] = useState('');
  const [criando, setCriando] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await chamarGestao<PainelTurmasDados>('/api/application/gestao/turmas'));
      setErro(undefined);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao carregar as turmas.');
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const recarregar = async () => {
    recarregarCatalogoCursos();
    await carregar();
  };

  const criar = async () => {
    setCriando(true);
    setErro(undefined);
    try {
      await chamarGestao('/api/application/gestao/turmas', { acao: 'CRIAR', posGraduacao: curso, codigo });
      setCodigo('');
      await recarregar();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao criar a turma.');
    } finally {
      setCriando(false);
    }
  };

  const porCurso = new Map<string, TurmaParaGestao[]>();
  for (const turma of dados?.turmas ?? []) porCurso.set(turma.posGraduacao, [...(porCurso.get(turma.posGraduacao) ?? []), turma]);

  return (
    <section className="space-y-4">
      {dados && <ConfigSaidaTurmas key={JSON.stringify([dados.prazo, dados.avisos])} prazo={dados.prazo} avisos={dados.avisos} onSalvo={carregar} />}
      {dados && !dados.cadastroDisponivel && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          O cadastro de turmas fica disponível depois da migration 092 no banco. Até lá, os encerramentos já feitos seguem o prazo de saída configurado.
        </p>
      )}
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}

      <div className="flex flex-wrap items-end gap-2 rounded-3xl border border-line bg-surface p-4 shadow-card">
        <label className="min-w-64 flex-1 text-[11px] font-bold text-muted">Pós-graduação
          <select value={curso} onChange={(event) => setCurso(event.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink">
            <option value="">Selecione…</option>
            {cursosParaSelecao(catalogo).map((nome) => <option key={nome} value={nome}>{nome}</option>)}
          </select>
        </label>
        <label className="w-32 text-[11px] font-bold text-muted">Turma
          <input value={codigo} onChange={(event) => setCodigo(event.target.value)} placeholder="26A" className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink" />
        </label>
        <button type="button" disabled={criando || !curso || !codigo.trim() || !dados?.cadastroDisponivel} onClick={() => void criar()} className="btn-primary min-h-10 justify-center disabled:opacity-50">
          <Plus className="h-4 w-4" /> Cadastrar turma
        </button>
      </div>

      {[...porCurso.entries()].map(([nome, turmas]) => (
        <div key={nome} className="rounded-3xl border border-line bg-surface shadow-card">
          <h3 className="border-b border-line px-4 py-3 text-sm font-extrabold text-ink">{nome}</h3>
          <ul className="divide-y divide-line">
            {turmas.map((turma) => (
              <li key={turma.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-sm font-black text-ink">Turma {turma.codigo}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${COR_SITUACAO[turma.situacao]}`}>{ROTULO_SITUACAO_TURMA[turma.situacao]}</span>
                  {turma.encerradaEm && <span className="text-muted">Encerrada em {formatarDataCurta(turma.encerradaEm)}</span>}
                  {turma.saidaEm && (
                    <span className="font-bold text-ink">
                      Saída da vitrine: {formatarDataCurta(turma.saidaEm)}{turma.situacao === 'EM_SAIDA' && turma.diasRestantes !== undefined ? ` (${rotuloRestante(turma.diasRestantes)})` : ''}
                    </span>
                  )}
                  {(turma.dataInicio || turma.dataEncerramentoPrevista) && (
                    <span className="text-muted">
                      {turma.dataInicio ? `Início ${formatarDataCurta(turma.dataInicio)}` : ''}{turma.dataEncerramentoPrevista ? ` · Encerramento previsto ${formatarDataCurta(turma.dataEncerramentoPrevista)}` : ''}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted">
                  {turma.psicologos.length
                    ? `${turma.psicologos.length} psicólogo(s): ${turma.psicologos.map((psi) => `${psi.nome}${psi.papel === 'SEGUNDA' ? ' (2ª pós)' : ''}${psi.aprovado ? '' : ' — vínculo pendente'}`).join(', ')}`
                    : 'Nenhum psicólogo vinculado.'}
                </p>
                <AcoesTurma turma={turma} onAlterada={recarregar} />
                {turma.historico.length > 0 && (
                  <button type="button" onClick={() => setHistoricoAberto(historicoAberto === turma.id ? null : turma.id)} className="text-[11px] font-bold text-psi-deep">
                    {historicoAberto === turma.id ? 'Ocultar histórico' : 'Ver histórico'}
                  </button>
                )}
                {historicoAberto === turma.id && (
                  <ul className="space-y-0.5 text-[11px] text-muted">
                    {[...turma.historico].reverse().map((evento, indice) => (
                      <li key={`${evento.em}-${indice}`}>{dataHoraBr(evento.em)} — {evento.acao.toLowerCase().replace(/_/g, ' ')}{evento.detalhe ? `: ${evento.detalhe}` : ''}{evento.porNome ? ` · ${evento.porNome}` : ''}</li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

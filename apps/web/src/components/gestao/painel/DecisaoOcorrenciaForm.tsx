'use client';

import { useState } from 'react';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';

export interface Ocorrencia {
  chave: string;
  categoria: string;
  titulo: string;
  descricao: string;
  ocorridoEm: string;
  href: string;
  situacao: 'aberta' | 'em_andamento' | 'resolvida';
  decisoes: Array<{ situacao: string; decisao: string; autorNome?: string; criadoEm: string }>;
}

const OPCOES: ReadonlyArray<[Ocorrencia['situacao'], string]> = [
  ['em_andamento', 'Em andamento'], ['resolvida', 'Resolvida'], ['aberta', 'Reabrir'],
];

/** Registro da intervenção: próximo passo e situação, com o histórico de decisões. */
export function DecisaoOcorrenciaForm({ ocorrencia, onRegistrada }: { ocorrencia: Ocorrencia; onRegistrada: (o: Ocorrencia) => void }) {
  const [decisao, setDecisao] = useState('');
  const [situacao, setSituacao] = useState<Ocorrencia['situacao']>(ocorrencia.situacao === 'aberta' ? 'em_andamento' : ocorrencia.situacao);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function registrar() {
    setEnviando(true);
    try {
      const atualizada = await chamarGestao<Ocorrencia>('/api/application/gestao/ocorrencias', { chave: ocorrencia.chave, situacao, decisao });
      onRegistrada(atualizada);
      setDecisao('');
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao registrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-line bg-white p-3">
      <label className="block text-[11px] font-bold text-muted">Decisão / próximo passo
        <textarea value={decisao} onChange={(e) => setDecisao(e.target.value)} rows={2} maxLength={2000}
          className="mt-1 block w-full rounded-xl border border-line px-3 py-2 text-xs text-ink" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select value={situacao} onChange={(e) => setSituacao(e.target.value as Ocorrencia['situacao'])}
          className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs text-ink">
          {OPCOES.map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
        <button type="button" disabled={enviando || decisao.trim().length < 3} onClick={() => void registrar()}
          className="btn-primary min-h-9 justify-center disabled:opacity-50">Registrar decisão</button>
        {erro && <span className="text-xs font-semibold text-rose-700">{erro}</span>}
      </div>
      {ocorrencia.decisoes.length > 0 && (
        <ol className="space-y-1 border-t border-line pt-2 text-[11px] text-muted">
          {ocorrencia.decisoes.map((d) => (
            <li key={`${d.criadoEm}-${d.decisao}`}>
              <span className="font-bold text-ink">{dataHoraBr(d.criadoEm)}</span>{d.autorNome ? ` · ${d.autorNome}` : ''} · {d.situacao.replace('_', ' ')} — {d.decisao}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

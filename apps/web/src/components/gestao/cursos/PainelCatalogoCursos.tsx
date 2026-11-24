'use client';

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, History, Plus } from 'lucide-react';
import type { CursoPos } from '@/components/forms/opcoesPsicologo';
import { recarregarCatalogoCursos } from '@/components/forms/useCatalogoCursos';
import { chamarGestao, dataHoraBr } from '@/components/gestao/gestaoApi';
import { FormularioCurso } from './FormularioCurso';

interface CatalogoParaGestao {
  cursos: CursoPos[];
  ajustados: string[];
  historico: { alteradoEm: string; alteradoPorNome?: string; cursos: string[] }[];
  editavel: boolean;
}

function duracoes(curso: CursoPos): string {
  if (curso.duracaoVariavel) return 'Variável';
  return curso.tempos.map((tempo) => (tempo === 90 ? '1h30' : `${tempo} min`)).join(' · ') || '—';
}

/** Catálogo de pós-graduações e permissões (1.01, 2.01 e § 14). */
export function PainelCatalogoCursos() {
  const [dados, setDados] = useState<CatalogoParaGestao | null>(null);
  const [editando, setEditando] = useState<string | 'novo' | null>(null);
  const [erro, setErro] = useState<string>();
  const [verHistorico, setVerHistorico] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setDados(await chamarGestao<CatalogoParaGestao>('/api/application/gestao/cursos'));
      setErro(undefined);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao carregar os cursos.');
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(carregar); }, [carregar]);

  const aposSalvar = async () => {
    setEditando(null);
    recarregarCatalogoCursos();
    await carregar();
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-xs text-muted">
          Cada pós-graduação tem as próprias modalidades, públicos, durações e formatos. Alterar um curso não muda os outros, e as alterações valem para o cadastro, a vitrine e o rodízio.
        </p>
        <button type="button" disabled={!dados?.editavel} onClick={() => setEditando('novo')} className="btn-primary min-h-10 justify-center disabled:opacity-50">
          <Plus className="h-4 w-4" /> Novo curso
        </button>
      </div>
      {dados && !dados.editavel && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">A edição do catálogo fica disponível depois da migration 087 no banco.</p>
      )}
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
      {editando === 'novo' && <FormularioCurso onSalvo={aposSalvar} onCancelar={() => setEditando(null)} />}

      <ul className="divide-y divide-line rounded-3xl border border-line bg-surface shadow-card">
        {(dados?.cursos ?? []).map((curso) => (
          <li key={curso.nome} className="space-y-2 p-4">
            {editando === curso.nome ? (
              <FormularioCurso curso={curso} onSalvo={aposSalvar} onCancelar={() => setEditando(null)} />
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-ink">
                    <GraduationCap className="h-4 w-4 shrink-0 text-psi-vibrant" /> {curso.nome}
                    {!curso.ativo && <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">Inativo</span>}
                    {dados?.ajustados.includes(curso.nome) && <span className="rounded-full border border-psi-soft bg-psi-soft/40 px-2 py-0.5 text-[10px] text-psi-deep">Ajustado pela Gestão</span>}
                  </p>
                  <p className="text-xs text-muted">{curso.servicos.join(', ')}</p>
                  <p className="text-[11px] text-muted">Públicos: {curso.publicos.join(', ')} · Duração: {duracoes(curso)}{curso.formatos.length ? ` · Formatos: ${curso.formatos.join(', ')}` : ''}</p>
                </div>
                <button type="button" disabled={!dados?.editavel} onClick={() => setEditando(curso.nome)} className="btn-ghost min-h-10 shrink-0 justify-center disabled:opacity-50">
                  Editar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {Boolean(dados?.historico.length) && (
        <div>
          <button type="button" onClick={() => setVerHistorico((atual) => !atual)} className="flex items-center gap-1 text-[11px] font-bold text-psi-deep">
            <History className="h-3.5 w-3.5" /> {verHistorico ? 'Ocultar histórico' : 'Ver histórico de alterações'}
          </button>
          {verHistorico && (
            <ul className="mt-2 space-y-1 text-[11px] text-muted">
              {dados!.historico.map((item) => (
                <li key={item.alteradoEm}>{dataHoraBr(item.alteradoEm)} — {item.cursos.join(', ') || 'catálogo'}{item.alteradoPorNome ? ` · ${item.alteradoPorNome}` : ''}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

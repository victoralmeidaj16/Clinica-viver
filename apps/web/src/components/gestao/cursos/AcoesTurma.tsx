'use client';

import { useState } from 'react';
import { hojeEmBrasilia } from '@/lib/turmaEncerrada';
import type { TurmaRegistro } from '@/lib/turmasCiclo';
import { chamarGestao } from '@/components/gestao/gestaoApi';

type Painel = 'ENCERRAR' | 'ALTERAR_SAIDA' | 'INTERROMPER_RETIRADA' | 'ALTERAR_ENCERRAMENTO' | 'EDITAR' | null;

const entrada = 'rounded-xl border border-line bg-white px-2.5 py-1.5 text-xs text-ink focus:border-psi-vibrant focus:outline-none';
const botao = 'rounded-xl border border-line bg-white px-2.5 py-1.5 text-[11px] font-bold text-ink hover:bg-slate-50 disabled:opacity-50';

/** Ações da Gestão sobre uma turma (1.01–1.05). Cada uma entra no histórico. */
export function AcoesTurma({ turma, onAlterada }: { turma: TurmaRegistro; onAlterada: () => Promise<void> }) {
  const [painel, setPainel] = useState<Painel>(null);
  const [data, setData] = useState('');
  const [data2, setData2] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();

  const enviar = async (corpo: Record<string, unknown>) => {
    setEnviando(true);
    setErro(undefined);
    try {
      await chamarGestao('/api/application/gestao/turmas', { id: turma.id, ...corpo });
      setPainel(null);
      setMotivo('');
      await onAlterada();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao alterar a turma.');
    } finally {
      setEnviando(false);
    }
  };

  const abrir = (proximo: Painel, inicial = '', inicial2 = '') => {
    setPainel(painel === proximo ? null : proximo);
    setData(inicial);
    setData2(inicial2);
    setErro(undefined);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {!turma.encerradaEm && (
          <button type="button" className={botao} onClick={() => abrir('ENCERRAR', hojeEmBrasilia())}>Encerrar turma</button>
        )}
        {turma.encerradaEm && (
          <>
            <button type="button" className={botao} disabled={enviando} onClick={() => void enviar({ acao: 'REABRIR' })}>Reabrir</button>
            <button type="button" className={botao} onClick={() => abrir('ALTERAR_SAIDA', turma.saidaManual ?? '')}>Prorrogar ou antecipar saída</button>
            <button type="button" className={botao} onClick={() => abrir('ALTERAR_ENCERRAMENTO', turma.encerradaEm)}>Corrigir data de encerramento</button>
            {turma.retiradaInterrompida
              ? <button type="button" className={botao} disabled={enviando} onClick={() => void enviar({ acao: 'RETOMAR_RETIRADA' })}>Retomar retirada</button>
              : <button type="button" className={botao} onClick={() => abrir('INTERROMPER_RETIRADA')}>Interromper retirada</button>}
          </>
        )}
        <button type="button" className={botao} onClick={() => abrir('EDITAR', turma.dataInicio ?? '', turma.dataEncerramentoPrevista ?? '')}>Editar datas</button>
      </div>

      {painel === 'ENCERRAR' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-bold text-muted">Data do encerramento<input type="date" value={data} onChange={(event) => setData(event.target.value)} className={`${entrada} block`} /></label>
          <button type="button" disabled={enviando || !data} className="btn-primary min-h-9 justify-center disabled:opacity-50" onClick={() => void enviar({ acao: 'ENCERRAR', encerradaEm: data })}>Confirmar encerramento</button>
        </div>
      )}
      {painel === 'ALTERAR_ENCERRAMENTO' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-bold text-muted">Nova data<input type="date" value={data} onChange={(event) => setData(event.target.value)} className={`${entrada} block`} /></label>
          <button type="button" disabled={enviando || !data} className="btn-primary min-h-9 justify-center disabled:opacity-50" onClick={() => void enviar({ acao: 'ALTERAR_ENCERRAMENTO', encerradaEm: data })}>Salvar data</button>
        </div>
      )}
      {painel === 'ALTERAR_SAIDA' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-bold text-muted">Saída em (vazio = prazo configurado)<input type="date" value={data} onChange={(event) => setData(event.target.value)} className={`${entrada} block`} /></label>
          <input value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Motivo (obrigatório)" className={`${entrada} min-w-48 flex-1`} />
          <button type="button" disabled={enviando || !motivo.trim()} className="btn-primary min-h-9 justify-center disabled:opacity-50" onClick={() => void enviar({ acao: 'ALTERAR_SAIDA', saidaEm: data || null, motivo })}>Salvar saída</button>
        </div>
      )}
      {painel === 'INTERROMPER_RETIRADA' && (
        <div className="flex flex-wrap items-end gap-2">
          <input value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Motivo da interrupção (obrigatório)" className={`${entrada} min-w-48 flex-1`} />
          <button type="button" disabled={enviando || !motivo.trim()} className="btn-primary min-h-9 justify-center disabled:opacity-50" onClick={() => void enviar({ acao: 'INTERROMPER_RETIRADA', motivo })}>Interromper</button>
        </div>
      )}
      {painel === 'EDITAR' && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] font-bold text-muted">Início<input type="date" value={data} onChange={(event) => setData(event.target.value)} className={`${entrada} block`} /></label>
          <label className="text-[11px] font-bold text-muted">Encerramento previsto<input type="date" value={data2} onChange={(event) => setData2(event.target.value)} className={`${entrada} block`} /></label>
          <button type="button" disabled={enviando} className="btn-primary min-h-9 justify-center disabled:opacity-50" onClick={() => void enviar({ acao: 'EDITAR', dataInicio: data || undefined, dataEncerramentoPrevista: data2 || undefined })}>Salvar datas</button>
        </div>
      )}
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
    </div>
  );
}

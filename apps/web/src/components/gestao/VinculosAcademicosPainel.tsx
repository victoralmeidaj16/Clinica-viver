'use client';

import { useState } from 'react';
import { CheckCircle2, Clock3, GraduationCap, XCircle } from 'lucide-react';
import { formatarDataCurta } from '@/lib/turmaEncerrada';
import { ROTULO_SITUACAO_TURMA, rotuloRestante } from '@/lib/turmasCiclo';
import { origemDosServicos, ROTULO_STATUS_VINCULO, type PapelVinculo, type SituacaoVinculo } from '@/lib/vinculoAcademico';
import { useCatalogoCursos } from '@/components/forms/useCatalogoCursos';
import { chamarGestao } from './gestaoApi';
import type { PsicologoItem } from './types';
import { TagStatus } from './TagStatus';

const MOTIVO: Record<NonNullable<SituacaoVinculo['motivoInvalido']>, string> = {
  NAO_APROVADO: 'não libera atendimento',
  TURMA_ENCERRADA: 'turma fora do prazo de saída',
  VALIDADE_VENCIDA: 'validade vencida',
};

// Tag neutra com a cor só no ícone, como os demais status da ficha.
const ICONE_STATUS = {
  APROVADO: { icone: CheckCircle2, cor: 'positivo' },
  PENDENTE: { icone: Clock3, cor: 'atencao' },
  RECUSADO: { icone: XCircle, cor: 'negativo' },
} as const satisfies Record<SituacaoVinculo['status'], { icone: typeof CheckCircle2; cor: 'positivo' | 'atencao' | 'negativo' }>;

/**
 * Vínculos acadêmicos do psicólogo na Gestão (especificação final, 1.01 passo
 * 6, 2.02, 3.2 e 3.10): cada pós com turma, aprovação própria e validade, e a
 * origem de cada serviço habilitado.
 */
export function VinculosAcademicosPainel({ p, onAlterado }: { p: PsicologoItem; onAlterado: () => void | Promise<void> }) {
  const catalogo = useCatalogoCursos();
  const [aberto, setAberto] = useState<PapelVinculo | null>(null);
  const [motivo, setMotivo] = useState('');
  const [validade, setValidade] = useState('');
  const [turma, setTurma] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string>();
  const situacao = p.situacaoAcademica;
  if (!situacao?.vinculos.length) return null;

  const enviar = async (papel: PapelVinculo, corpo: Record<string, unknown>) => {
    setEnviando(true);
    setErro(undefined);
    try {
      await chamarGestao(`/api/application/gestao/psicologos/${encodeURIComponent(p.id)}/vinculos`, { papel, ...corpo });
      setAberto(null);
      setMotivo('');
      await onAlterado();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao atualizar o vínculo.');
    } finally {
      setEnviando(false);
    }
  };

  const origens = origemDosServicos(p.servicosPrestados ?? [], situacao, catalogo.cursos);

  return (
    <section className="space-y-2 rounded-2xl border border-psi-soft/60 bg-white p-3">
      <h4 className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-ink">
        <GraduationCap className="h-3.5 w-3.5 text-psi-vibrant" /> Vínculos acadêmicos
      </h4>
      {situacao.vinculos.map((vinculo) => (
        // Cada curso é uma linha da seção, não um card dentro do card.
        <div key={vinculo.papel} className="space-y-1.5 border-t border-line pt-2.5 text-xs first-of-type:border-t-0 first-of-type:pt-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-ink">{vinculo.posGraduacao}</span>
            <span className="text-muted">· Turma {vinculo.turma ?? 'não informada'}{vinculo.papel === 'SEGUNDA' ? ' · 2ª pós' : ''}</span>
            <TagStatus icone={ICONE_STATUS[vinculo.status].icone} cor={ICONE_STATUS[vinculo.status].cor}>{ROTULO_STATUS_VINCULO[vinculo.status]}</TagStatus>
            {!vinculo.valido && vinculo.motivoInvalido && vinculo.status === 'APROVADO' && (
              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">Sem validade: {MOTIVO[vinculo.motivoInvalido]}</span>
            )}
          </div>
          {vinculo.situacaoTurma && vinculo.situacaoTurma !== 'ABERTA' && (
            <p className="text-[11px] text-muted">
              {ROTULO_SITUACAO_TURMA[vinculo.situacaoTurma]}
              {vinculo.saidaEm ? ` · saída ${formatarDataCurta(vinculo.saidaEm)}${vinculo.situacaoTurma === 'EM_SAIDA' && vinculo.diasRestantes !== undefined ? ` (${rotuloRestante(vinculo.diasRestantes)})` : ''}` : ''}
            </p>
          )}
          {vinculo.decisao && (
            <p className="text-[11px] text-muted">
              Decidido em {formatarDataCurta(vinculo.decisao.decididoEm)}{vinculo.decisao.decididoPorNome ? ` por ${vinculo.decisao.decididoPorNome}` : ''}
              {vinculo.decisao.motivo ? ` — ${vinculo.decisao.motivo}` : ''}{vinculo.decisao.validoAte ? ` · válido até ${formatarDataCurta(vinculo.decisao.validoAte)}` : ''}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {vinculo.status !== 'APROVADO' && (
              <button type="button" disabled={enviando} onClick={() => void enviar(vinculo.papel, { status: 'APROVADO' })} className="rounded-lg border border-emerald-300 px-2 py-1 font-bold text-emerald-800 hover:bg-emerald-50">Aprovar vínculo</button>
            )}
            <button type="button" onClick={() => { setAberto(aberto === vinculo.papel ? null : vinculo.papel); setValidade(vinculo.decisao?.validoAte ?? ''); setTurma(vinculo.turma ?? ''); }} className="rounded-lg border border-line px-2 py-1 font-bold text-ink hover:bg-slate-50">Mais decisões</button>
          </div>
          {aberto === vinculo.papel && (
            <div className="space-y-1.5 border-t border-line pt-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <input value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Motivo (obrigatório para recusar)" className="min-w-44 flex-1 rounded-lg border border-line px-2 py-1" />
                <button type="button" disabled={enviando} onClick={() => void enviar(vinculo.papel, { status: 'PENDENTE', motivo })} className="rounded-lg border border-amber-300 px-2 py-1 font-bold text-amber-800">Deixar pendente</button>
                <button type="button" disabled={enviando || !motivo.trim()} onClick={() => void enviar(vinculo.papel, { status: 'RECUSADO', motivo })} className="rounded-lg border border-rose-300 px-2 py-1 font-bold text-rose-800 disabled:opacity-50">Recusar</button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {vinculo.status !== 'RECUSADO' && (
                  <>
                    <label className="text-[11px] font-bold text-muted">Válido até <input type="date" value={validade} onChange={(event) => setValidade(event.target.value)} className="rounded-lg border border-line px-2 py-1" /></label>
                    <button type="button" disabled={enviando} onClick={() => void enviar(vinculo.papel, { status: vinculo.status, validoAte: validade || null, motivo: vinculo.decisao?.motivo })} className="rounded-lg border border-line px-2 py-1 font-bold text-ink">Salvar validade</button>
                  </>
                )}
                <input value={turma} onChange={(event) => setTurma(event.target.value)} placeholder="Turma" className="w-20 rounded-lg border border-line px-2 py-1" />
                <button type="button" disabled={enviando || !turma.trim()} onClick={() => void enviar(vinculo.papel, { acao: 'TURMA', turma })} className="rounded-lg border border-line px-2 py-1 font-bold text-ink disabled:opacity-50">Corrigir turma</button>
              </div>
            </div>
          )}
        </div>
      ))}
      {Object.keys(origens).length > 0 && (
        <p className="text-[11px] text-muted">
          Origem das autorizações: {Object.entries(origens).map(([servico, cursos]) => `${servico} — ${cursos.length ? cursos.join(' e ') : 'nenhum vínculo válido'}`).join('; ')}.
        </p>
      )}
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
    </section>
  );
}

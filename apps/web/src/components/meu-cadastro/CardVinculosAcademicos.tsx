'use client';

import { AlertTriangle, GraduationCap } from 'lucide-react';
import { formatarDataCurta } from '@/lib/turmaEncerrada';
import { rotuloRestante } from '@/lib/turmasCiclo';
import { ROTULO_STATUS_VINCULO, type SituacaoAcademica, type SituacaoVinculo } from '@/lib/vinculoAcademico';

interface Props {
  situacao?: SituacaoAcademica;
  /** Texto do aviso configurado pela Gestão para o marco atual da contagem. */
  textoAviso?: string;
}

function situacaoDaTurma(vinculo: SituacaoVinculo): string | undefined {
  if (vinculo.situacaoTurma === 'EM_SAIDA' && vinculo.saidaEm) {
    const restante = vinculo.diasRestantes === undefined ? '' : ` (${rotuloRestante(vinculo.diasRestantes)})`;
    return `Turma encerrada${vinculo.encerradaEm ? ` em ${formatarDataCurta(vinculo.encerradaEm)}` : ''}. Saída da vitrine em ${formatarDataCurta(vinculo.saidaEm)}${restante}.`;
  }
  if (vinculo.situacaoTurma === 'SAIDA_INTERROMPIDA') return 'Turma encerrada. A Gestão suspendeu a retirada da vitrine.';
  if (vinculo.situacaoTurma === 'DESLIGADA') return 'Turma encerrada e fora do prazo de saída.';
  if (vinculo.motivoInvalido === 'VALIDADE_VENCIDA') return 'A validade deste vínculo venceu.';
  return undefined;
}

/**
 * Vínculos acadêmicos vistos pelo próprio psicólogo (especificação final,
 * 1.02–1.04, 3.2 e 3.10): cada pós com a turma, a decisão da Gestão e a
 * contagem até a saída da vitrine quando a turma encerra.
 */
export function CardVinculosAcademicos({ situacao, textoAviso }: Props) {
  if (!situacao?.vinculos.length) return null;

  return (
    <section className="space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-card">
      <div className="flex items-center gap-3 border-b border-line pb-4">
        <GraduationCap className="h-5 w-5 text-psi-vibrant" />
        <h2 className="text-sm font-extrabold text-ink">Formação na Viver Mais</h2>
      </div>

      {textoAviso && (
        <p className="flex gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {textoAviso}
        </p>
      )}
      {situacao.desligado && (
        <p className="rounded-2xl border border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
          Seu perfil saiu da vitrine e do rodízio porque nenhuma pós-graduação está válida. Agenda, pacientes,
          prontuários e financeiro continuam preservados.
        </p>
      )}

      <ul className="space-y-3">
        {situacao.vinculos.map((vinculo) => {
          const turma = situacaoDaTurma(vinculo);
          return (
            <li key={vinculo.papel} className="space-y-1 rounded-2xl border border-line p-3 text-xs">
              <p className="font-bold text-ink">
                {vinculo.posGraduacao}
                <span className="font-normal text-muted"> · Turma {vinculo.turma ?? 'não informada'}{vinculo.papel === 'SEGUNDA' ? ' · 2ª pós' : ''}</span>
              </p>
              <p className="text-muted">
                {ROTULO_STATUS_VINCULO[vinculo.status]}
                {vinculo.status === 'RECUSADO' && vinculo.decisao?.motivo ? ` — ${vinculo.decisao.motivo}` : ''}
                {vinculo.decisao?.validoAte ? ` · válido até ${formatarDataCurta(vinculo.decisao.validoAte)}` : ''}
              </p>
              {turma && <p className="font-semibold text-ink">{turma}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

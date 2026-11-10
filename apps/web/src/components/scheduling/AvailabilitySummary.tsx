import { DURACOES_SESSAO, duracaoPermitida } from '@/lib/duracaoSessao';
import type { JanelaEditavel } from './availabilityEditorModel';
import { configDaGrade, ORDEM_SEMANA } from './availabilityStepsModel';
import { AvailabilitySummaryContent } from './AvailabilitySummaryContent';

interface Props {
  janelas: readonly JanelaEditavel[];
  duracoesFixas?: readonly number[];
  permiteDuracaoVariavel?: boolean;
  onEditar: () => void;
}

export function AvailabilitySummary({ janelas, duracoesFixas = DURACOES_SESSAO, permiteDuracaoVariavel = false, onEditar }: Props) {
  const { config, uniforme } = configDaGrade(janelas);
  const incompativel = janelas.some((janela) => !duracaoPermitida(janela.duracaoMin, duracoesFixas, permiteDuracaoVariavel));
  const grupos = uniforme ? [config] : ORDEM_SEMANA.flatMap((dia) =>
    janelas.filter((janela) => janela.diaSemana === dia)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))
      .map((janela) => configDaGrade([janela]).config)
  );

  return (
    <section aria-labelledby="resumo-disponibilidade" className="space-y-4 rounded-[20px] border border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="resumo-disponibilidade" className="text-base font-black text-psi-darkest">Resumo da sua disponibilidade</h2>
          <p className="mt-1 text-xs text-muted">Grade semanal salva. Sessões agendadas e bloqueios reduzem os horários livres.</p>
        </div>
        <button type="button" onClick={onEditar} className="btn-outline px-4 py-2 text-xs">Editar disponibilidade</button>
      </div>
      {incompativel && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
          A grade salva tem uma duração diferente das permitidas no seu cadastro. Abra “Editar disponibilidade”, confira o tempo corrigido e salve para atualizar os horários.
        </p>
      )}
      {janelas.length === 0
        ? <p className="text-sm text-muted">Nenhum horário de atendimento cadastrado.</p>
        : grupos.map((grupo, indice) => (
          <div key={indice} className="space-y-3"><AvailabilitySummaryContent config={grupo} /></div>
        ))}
    </section>
  );
}

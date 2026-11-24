import type { LucideIcon } from 'lucide-react';
import { Award, CheckCircle2, Clock3, Copy, PauseCircle, UserCheck, UserPlus, UsersRound } from 'lucide-react';
import { COR_ICONE } from './TagStatus';

const botaoSecundario = 'btn-outline px-4 py-2.5 text-[13px] font-bold disabled:cursor-not-allowed disabled:opacity-50';
const chipValor = 'rounded-lg border border-psi-soft bg-white px-2 py-0.5 text-xs font-extrabold tabular-nums text-psi-darkest';

/**
 * Cabeçalho da Gestão de Psicólogos, no padrão da página de referência
 * (Agenda & Horários): etiqueta lilás, título em `ink`, uma única ação de
 * destaque (`btn-accent`) e as demais em `btn-outline`.
 */
export function PsicologosCabecalho({
  limiteDesabilitado,
  linkCopiado,
  onLimiteTodos,
  onCopiarLink,
  onCadastrar,
}: {
  limiteDesabilitado: boolean;
  linkCopiado: boolean;
  onLimiteTodos: () => void;
  onCopiarLink: () => void;
  onCadastrar: () => void;
}) {
  return (
    <header className="flex flex-col justify-between gap-4 rounded-[20px] border border-line bg-surface p-6 shadow-card lg:flex-row lg:items-end">
      <div>
        <span className="chip-accent mb-1 text-[11px]">Gestão da equipe clínica</span>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <UserCheck aria-hidden className="h-6 w-6 text-psi-vibrant" /> Psicólogos credenciados
        </h1>
        <p className="mt-0.5 max-w-xl text-sm text-muted">
          Corpo clínico, capacidade de atendimento e quem está no rodízio de encaminhamento.
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {/* O relatório de estágio fica junto do corpo clínico: quem presta contas
            das horas é o psicólogo, e é nesta tela que a gestão cuida de cada um. */}
        <a href="/relatorios/declaracao" className={botaoSecundario}>
          <Award aria-hidden className="h-4 w-4 text-psi-vibrant" /> Relatório de estágio
        </a>
        <button type="button" onClick={onLimiteTodos} disabled={limiteDesabilitado} className={botaoSecundario}>
          <UsersRound aria-hidden className="h-4 w-4 text-psi-vibrant" /> Limite para todos
        </button>
        <button type="button" onClick={onCadastrar} className={botaoSecundario}>
          <UserPlus aria-hidden className="h-4 w-4 text-psi-vibrant" /> Cadastrar manualmente
        </button>
        <button type="button" onClick={onCopiarLink} className="btn-accent px-5 py-2.5 text-[13px]">
          {linkCopiado ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : <Copy aria-hidden className="h-4 w-4" />}
          {linkCopiado ? 'Link copiado' : 'Copiar link de cadastro'}
        </button>
      </div>
    </header>
  );
}

function Indicador({
  rotulo,
  valor,
  icone: Icone,
  corIcone,
  lateral,
  children,
}: {
  rotulo: string;
  valor: number;
  icone: LucideIcon;
  corIcone: string;
  lateral?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5 rounded-[20px] border border-line bg-surface p-5 shadow-card">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
        <Icone aria-hidden className={`h-4 w-4 ${valor > 0 ? corIcone : COR_ICONE.neutro}`} /> {rotulo}
      </p>
      <div className="flex items-center justify-between gap-3">
        <span className={`text-3xl font-black tabular-nums ${valor > 0 ? 'text-ink' : 'text-muted/60'}`}>{valor}</span>
        {lateral}
      </div>
      {children}
    </div>
  );
}

/**
 * Os três números da equipe. A cor de estado fica só no ícone (regra da tag
 * neutra do design.md); o número é sempre `ink`, e o zero fica apagado.
 */
export function PsicologosIndicadores({
  noRodizio,
  total,
  ausentes,
  desligadosPorTurma,
  pendentes,
  pausados,
  onVerPendentes,
}: {
  noRodizio: number;
  total: number;
  ausentes: number;
  desligadosPorTurma: number;
  pendentes: number;
  pausados: number;
  onVerPendentes: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Indicador rotulo="No rodízio" valor={noRodizio} icone={CheckCircle2} corIcone={COR_ICONE.positivo}
        lateral={<span className={chipValor}>de {total}</span>}>
        {ausentes > 0 && (
          <p className="text-xs text-muted">
            {ausentes === 1 ? '1 profissional de férias ou folga hoje' : `${ausentes} profissionais de férias ou folga hoje`}
          </p>
        )}
        {desligadosPorTurma > 0 && (
          <p className="text-xs text-muted">
            {desligadosPorTurma === 1
              ? '1 profissional fora por turma encerrada'
              : `${desligadosPorTurma} profissionais fora por turma encerrada`}
          </p>
        )}
      </Indicador>

      <Indicador rotulo="Aguardando análise" valor={pendentes} icone={Clock3} corIcone={COR_ICONE.atencao}
        lateral={pendentes > 0 && (
          <button type="button" onClick={onVerPendentes} className="btn-outline px-3 py-1.5 text-xs font-bold">Ver</button>
        )} />

      <Indicador rotulo="Pausados" valor={pausados} icone={PauseCircle} corIcone={COR_ICONE.negativo}
        lateral={<span className={chipValor}>Sem encaminhamento</span>}>
        <p className="text-xs text-muted">Fora do rodízio e da vitrine</p>
      </Indicador>
    </div>
  );
}

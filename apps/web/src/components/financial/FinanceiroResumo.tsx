import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, Building2, CreditCard, FileSpreadsheet, Filter, RefreshCw, TrendingUp, Users, Wallet } from 'lucide-react';
import { COR_ICONE } from '@/components/gestao/TagStatus';
import { CAMPO, ROTULO } from '@/components/ui/estilosFormulario';

export interface ResumoFinanceiro {
  atendimentos: number;
  liquidados: number;
  vencidos: number;
  faturadoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  vencidoCents: number;
  inadimplencia: number;
  creditoPsicologosCents: number;
  receitaClinicaCents: number;
  provisionadoConvenioCents: number;
}

export interface ConsolidadoPsicologo {
  psicologoId: string;
  psicologoNome: string;
  atendimentos: number;
  faturadoCents: number;
  recebidoCents: number;
  emAbertoCents: number;
  creditoPsicologoCents: number;
  receitaClinicaCents: number;
}

export const dinheiro = (centavos: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centavos / 100);

/** Cabeçalho no padrão da Agenda & Horários, com o filtro de período logo abaixo. */
export function FinanceiroCabecalho({
  dataInicio, dataFim, onDataInicio, onDataFim, onFiltrar, carregando, exportando, podeExportar, onExportar,
}: {
  dataInicio: string;
  dataFim: string;
  onDataInicio: (valor: string) => void;
  onDataFim: (valor: string) => void;
  onFiltrar: (evento: React.FormEvent) => void;
  carregando: boolean;
  exportando: boolean;
  podeExportar: boolean;
  onExportar: () => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="chip-accent mb-1 text-[11px]">Extrato financeiro da clínica</span>
          <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
            <CreditCard aria-hidden className="h-6 w-6 text-psi-vibrant" /> Financeiro & Repasses
          </h1>
          <p className="max-w-3xl text-xs text-muted">
            O outro lado do extrato do psicólogo: quanto entrou no período, quanto é receita da clínica (30%) e
            quanto está reservado como crédito de abatimento dos alunos (70%).
          </p>
        </div>
        <button type="button" onClick={onExportar} disabled={exportando || !podeExportar}
          className="btn-outline shrink-0 px-4 py-2.5 text-[13px] font-bold disabled:opacity-50">
          <FileSpreadsheet aria-hidden className="h-4 w-4 text-psi-vibrant" />
          {exportando ? 'Gerando…' : 'Exportar relatório (CSV)'}
        </button>
      </div>

      <form onSubmit={onFiltrar}
        className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-end sm:p-6">
        <label className={`${ROTULO} sm:w-48`} htmlFor="data-inicio">Data inicial
          <input id="data-inicio" type="date" value={dataInicio} onChange={(evento) => onDataInicio(evento.target.value)} className={CAMPO} />
        </label>
        <label className={`${ROTULO} sm:w-48`} htmlFor="data-fim">Data final
          <input id="data-fim" type="date" value={dataFim} onChange={(evento) => onDataFim(evento.target.value)} className={CAMPO} />
        </label>
        <button type="submit" disabled={carregando} className="btn-primary px-5 py-2.5 text-[13px] sm:ml-auto">
          {carregando ? <RefreshCw aria-hidden className="h-4 w-4 animate-spin" /> : <Filter aria-hidden className="h-4 w-4" />}
          {carregando ? 'Carregando…' : 'Filtrar período'}
        </button>
      </form>
    </>
  );
}

function Indicador({ rotulo, valor, detalhe, icone: Icone, corIcone }: {
  rotulo: string; valor: string; detalhe: string; icone: LucideIcon; corIcone: string;
}) {
  return (
    <article className="rounded-[20px] border border-line bg-surface p-5 shadow-card">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
        <Icone aria-hidden className={`h-4 w-4 ${corIcone}`} /> {rotulo}
      </p>
      <p className="mt-3 text-2xl font-black tabular-nums text-ink">{valor}</p>
      <p className="mt-1 text-xs text-muted">{detalhe}</p>
    </article>
  );
}

/**
 * Um único bloco escuro de destaque (receita da clínica), como o link de
 * agendamento da Agenda; os demais números em cards brancos, com a cor de
 * estado só no ícone.
 */
export function FinanceiroIndicadores({ resumo }: { resumo?: ResumoFinanceiro }) {
  const r = resumo;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="space-y-4 rounded-3xl bg-psi-darkest p-6 text-white shadow-contrast">
        <p className="flex items-center gap-2 font-black">
          <Building2 aria-hidden className="h-4 w-4 text-psi-soft" /> Receita da clínica (30%)
        </p>
        <div>
          <p className="text-3xl font-black tabular-nums">{dinheiro(r?.receitaClinicaCents ?? 0)}</p>
          <p className="mt-1 text-xs text-white/70">Sobre {dinheiro(r?.recebidoCents ?? 0)} efetivamente recebidos no período</p>
        </div>
        <div className="border-t border-white/10 pt-4">
          <p className="text-xs text-white/70">Crédito dos psicólogos (70%)</p>
          <p className="text-lg font-black tabular-nums">{dinheiro(r?.creditoPsicologosCents ?? 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:col-span-2">
        <Indicador rotulo="Faturado no período" valor={dinheiro(r?.faturadoCents ?? 0)} icone={TrendingUp} corIcone={COR_ICONE.marca}
          detalhe={`${r?.atendimentos ?? 0} atendimentos · ${r?.liquidados ?? 0} liquidados`} />
        <Indicador rotulo="Provisionado de convênios" valor={dinheiro(r?.provisionadoConvenioCents ?? 0)} icone={Building2}
          corIcone={COR_ICONE.marca} detalhe="A faturar ou aguardando baixa do boleto" />
        <Indicador rotulo="Recebido" valor={dinheiro(r?.recebidoCents ?? 0)} icone={Wallet} corIcone={COR_ICONE.positivo}
          detalhe="Pagamentos confirmados menos estornos" />
        <Indicador rotulo="Em aberto" valor={dinheiro(r?.emAbertoCents ?? 0)} icone={AlertTriangle}
          corIcone={(r?.vencidoCents ?? 0) > 0 ? COR_ICONE.atencao : COR_ICONE.neutro}
          detalhe={`${dinheiro(r?.vencidoCents ?? 0)} vencidos · ${((r?.inadimplencia ?? 0) * 100).toFixed(1).replace('.', ',')}% de inadimplência`} />
      </div>
    </div>
  );
}

/** Tabela no padrão da Gestão de Pacientes: contorno lilás, cabeçalho em caixa alta, números em `ink`. */
export function ConsolidadoPorPsicologo({ linhas, carregando }: { linhas: readonly ConsolidadoPsicologo[]; carregando: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-psi-soft/60 bg-surface shadow-card">
      <div className="flex items-center justify-between gap-4 border-b border-psi-soft/60 p-5 sm:p-6">
        <div>
          <h2 className="flex items-center gap-2 text-base font-black text-psi-darkest">
            <Users aria-hidden className="h-4 w-4 text-psi-vibrant" /> Consolidado por psicólogo
          </h2>
          <p className="mt-1 text-xs text-muted">Quanto cada psicólogo gerou e quanto tem de crédito a abater na mensalidade</p>
        </div>
        <span className="whitespace-nowrap rounded-lg border border-psi-soft bg-white px-2 py-0.5 text-xs font-extrabold text-psi-darkest">
          {linhas.length} psicólogos
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-left text-xs">
          <thead className="border-b border-psi-soft/60 bg-psi-soft/30 text-[10px] font-black uppercase tracking-[0.14em] text-muted">
            <tr>
              {['Psicólogo', 'Atendimentos', 'Faturado', 'Recebido', 'Em aberto', 'Crédito (70%)', 'Clínica (30%)'].map((titulo) => (
                <th key={titulo} className="px-6 py-4">{titulo}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-psi-soft/40">
            {linhas.map((item) => (
              <tr key={item.psicologoId} className="transition-colors hover:bg-psi-soft/30">
                <td className="px-6 py-4 font-black text-ink">{item.psicologoNome}</td>
                <td className="px-6 py-4 text-muted">{item.atendimentos}</td>
                <td className="px-6 py-4 font-bold tabular-nums text-ink">{dinheiro(item.faturadoCents)}</td>
                <td className="px-6 py-4 font-bold tabular-nums text-ink">{dinheiro(item.recebidoCents)}</td>
                <td className={`px-6 py-4 font-semibold tabular-nums ${item.emAbertoCents > 0 ? 'text-ink' : 'text-muted'}`}>{dinheiro(item.emAbertoCents)}</td>
                <td className="px-6 py-4 font-black tabular-nums text-ink">{dinheiro(item.creditoPsicologoCents)}</td>
                <td className="px-6 py-4 font-black tabular-nums text-psi-deep">{dinheiro(item.receitaClinicaCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!carregando && linhas.length === 0 && (
          <p className="p-10 text-center text-xs text-muted">Nenhum atendimento com cobrança registrada nesse período.</p>
        )}
      </div>
    </section>
  );
}

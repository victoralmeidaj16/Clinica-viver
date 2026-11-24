'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, FileText, FileBarChart, RefreshCw } from 'lucide-react';
import { AREAS_RELATORIO, type AreaRelatorioId, type FiltrosAplicados, type LinhaRelatorio } from '@/lib/relatorios/areas';
import { chamarGestao } from '@/components/gestao/gestaoApi';
import { FiltrosRelatorio } from '@/components/gestao/relatorios/FiltrosRelatorio';
import { TabelaRelatorio } from '@/components/gestao/relatorios/TabelaRelatorio';

function inicioDoMes(): string {
  const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return `${hoje.slice(0, 8)}01`;
}

/**
 * Relatórios por área (especificação final, 13.05): psicólogos, turmas,
 * pacientes, fila, agendamentos, atendimentos, horas de estágio, financeiro,
 * convênios, Créditos Educacionais, alterações e avisos — com filtros e
 * exportação Excel e PDF. Nenhuma área inclui prontuário.
 */
export default function GestaoRelatoriosPage() {
  const [areaId, setAreaId] = useState<AreaRelatorioId>('agendamentos');
  const [filtros, setFiltros] = useState<FiltrosAplicados>(() => ({ desde: inicioDoMes() }));
  const [linhas, setLinhas] = useState<LinhaRelatorio[] | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const area = AREAS_RELATORIO.find((item) => item.id === areaId)!;

  const consulta = useMemo(() => {
    const params = new URLSearchParams({ area: areaId });
    for (const [chave, valor] of Object.entries(filtros)) if (valor) params.set(chave, valor);
    return params;
  }, [areaId, filtros]);

  const gerar = useCallback(async () => {
    setCarregando(true);
    try {
      const dados = await chamarGestao<{ linhas: LinhaRelatorio[] }>(`/api/application/gestao/relatorios?${consulta}`);
      setLinhas(dados.linhas);
      setErro(null);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao gerar o relatório.');
      setLinhas(null);
    } finally {
      setCarregando(false);
    }
  }, [consulta]);

  useEffect(() => { void Promise.resolve().then(gerar); }, [areaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportar = (formato: 'xlsx' | 'pdf') => `/api/application/gestao/relatorios?${new URLSearchParams([...consulta, ['formato', formato]])}`;

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <FileBarChart className="h-6 w-6 text-psi-vibrant" /> Relatórios por área
        </h1>
        <p className="text-xs text-muted">
          Os mesmos registros dos módulos operacionais, com filtros e exportação. Prontuários e anotações clínicas não entram em nenhum relatório.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {AREAS_RELATORIO.map((item) => (
          <button key={item.id} type="button" onClick={() => { setAreaId(item.id); setLinhas(null); }}
            className={`rounded-2xl px-4 py-2 text-xs font-extrabold transition-all ${
              item.id === areaId ? 'bg-psi-vibrant text-white shadow-md' : 'border border-line bg-surface text-muted hover:bg-slate-100 hover:text-ink'}`}>
            {item.titulo}
          </button>
        ))}
      </div>

      <section className="space-y-4 rounded-3xl border border-line bg-surface p-4 shadow-card">
        <p className="text-xs text-muted">{area.descricao}</p>
        <FiltrosRelatorio area={area} filtros={filtros} onChange={setFiltros} />
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={carregando} onClick={() => void gerar()} className="btn-primary min-h-10 justify-center disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${carregando ? 'animate-spin' : ''}`} /> Aplicar filtros
          </button>
          <a href={exportar('xlsx')} className="btn-ghost min-h-10 justify-center"><FileSpreadsheet className="h-4 w-4" /> Excel</a>
          <a href={exportar('pdf')} className="btn-ghost min-h-10 justify-center"><FileText className="h-4 w-4" /> PDF</a>
        </div>
      </section>

      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
      {linhas && <TabelaRelatorio area={area} linhas={linhas} />}
      {!linhas && carregando && <p className="text-xs text-muted">Gerando…</p>}
    </div>
  );
}

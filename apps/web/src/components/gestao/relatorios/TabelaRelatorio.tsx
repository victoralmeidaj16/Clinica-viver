'use client';

import { formatarCelula, type AreaRelatorio, type LinhaRelatorio } from '@/lib/relatorios/areas';

const PREVIA = 200;

/** Prévia na tela; a exportação leva todas as linhas. */
export function TabelaRelatorio({ area, linhas }: { area: AreaRelatorio; linhas: LinhaRelatorio[] }) {
  const totais = area.colunas.filter((c) => c.tipo === 'moeda').map((c) => ({
    coluna: c,
    soma: linhas.reduce((n, linha) => n + (typeof linha[c.chave] === 'number' ? Number(linha[c.chave]) : 0), 0),
  }));
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted">
        {linhas.length} registro(s){linhas.length > PREVIA ? ` — a tela mostra os ${PREVIA} primeiros; o Excel e o PDF trazem todos` : ''}.
        {totais.map(({ coluna, soma }) => ` ${coluna.rotulo}: ${formatarCelula(soma, 'moeda')}.`)}
      </p>
      <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-card">
        <table className="w-full min-w-[48rem] text-left text-xs">
          <thead className="border-b border-line text-[11px] uppercase tracking-wide text-muted">
            <tr>{area.colunas.map((c) => <th key={c.chave} className="whitespace-nowrap px-3 py-2">{c.rotulo}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line">
            {linhas.length === 0 && (
              <tr><td colSpan={area.colunas.length} className="px-3 py-6 text-center text-muted">Nenhum registro com os filtros escolhidos.</td></tr>
            )}
            {linhas.slice(0, PREVIA).map((linha, i) => (
              <tr key={i} className="align-top">
                {area.colunas.map((c) => (
                  <td key={c.chave} className={`px-3 py-2 ${c.tipo === 'texto' ? 'text-ink' : 'whitespace-nowrap text-muted'}`}>
                    {formatarCelula(linha[c.chave], c.tipo)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

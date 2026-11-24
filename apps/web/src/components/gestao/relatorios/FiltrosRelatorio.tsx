'use client';

import { ROTULO_MODULO } from '@/lib/auditoria';
import type { AreaRelatorio, FiltrosAplicados, FiltroRelatorio } from '@/lib/relatorios/areas';

interface Props {
  area: AreaRelatorio;
  filtros: FiltrosAplicados;
  onChange: (filtros: FiltrosAplicados) => void;
}

const TEXTO: Partial<Record<FiltroRelatorio, { chave: keyof FiltrosAplicados; rotulo: string; dica: string }>> = {
  profissional: { chave: 'profissional', rotulo: 'Psicólogo', dica: 'Nome ou parte dele' },
  paciente: { chave: 'paciente', rotulo: 'Paciente', dica: 'Nome ou protocolo' },
  curso: { chave: 'curso', rotulo: 'Curso', dica: 'Pós-graduação' },
  turma: { chave: 'turma', rotulo: 'Turma', dica: 'Código da turma' },
  empresa: { chave: 'empresa', rotulo: 'Empresa', dica: 'Convênio, razão social ou CNPJ' },
};

const CAMPO = 'mt-1 block w-full rounded-xl border border-line bg-white px-3 py-1.5 text-xs text-ink';

/** Só os filtros que a área aceita (13.05). */
export function FiltrosRelatorio({ area, filtros, onChange }: Props) {
  const definir = (chave: keyof FiltrosAplicados, valor: string) => onChange({ ...filtros, [chave]: valor || undefined });
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {area.filtros.includes('periodo') && (
        <>
          <label className="text-[11px] font-bold text-muted">
            De {area.periodoSobre ? <span className="font-normal">({area.periodoSobre})</span> : null}
            <input type="date" value={filtros.desde ?? ''} onChange={(e) => definir('desde', e.target.value)} className={CAMPO} />
          </label>
          <label className="text-[11px] font-bold text-muted">
            Até
            <input type="date" value={filtros.ate ?? ''} onChange={(e) => definir('ate', e.target.value)} className={CAMPO} />
          </label>
        </>
      )}
      {area.filtros.map((filtro) => {
        const texto = TEXTO[filtro];
        if (!texto) return null;
        return (
          <label key={filtro} className="text-[11px] font-bold text-muted">
            {texto.rotulo}
            <input value={filtros[texto.chave] ?? ''} placeholder={texto.dica}
              onChange={(e) => definir(texto.chave, e.target.value)} className={CAMPO} />
          </label>
        );
      })}
      {area.filtros.includes('modulo') && (
        <label className="text-[11px] font-bold text-muted">
          Módulo
          <select value={filtros.modulo ?? ''} onChange={(e) => definir('modulo', e.target.value)} className={CAMPO}>
            <option value="">Todos</option>
            {Object.entries(ROTULO_MODULO).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

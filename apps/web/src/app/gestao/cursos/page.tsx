'use client';

import { useEffect, useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { PainelCatalogoCursos } from '@/components/gestao/cursos/PainelCatalogoCursos';
import { PainelTurmasCursos } from '@/components/gestao/cursos/PainelTurmasCursos';
import { PainelDemandas } from '@/components/gestao/cursos/PainelDemandas';

type Aba = 'cursos' | 'turmas' | 'demandas';

const ABAS: ReadonlyArray<[Aba, string]> = [
  ['cursos', 'Cursos e permissões'],
  ['turmas', 'Turmas e prazo de saída'],
  ['demandas', 'Demandas clínicas'],
];

/**
 * Configuração acadêmica da clínica pela Gestão (especificação final, 1.01–1.05,
 * 2.01 e 3.4): catálogo de pós-graduações, turmas de cada curso com o ciclo de
 * encerramento e as demandas clínicas usadas no cadastro e na vitrine.
 */
export default function GestaoCursosPage() {
  const [aba, setAba] = useState<Aba>('cursos');

  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get('aba');
    if (pedida === 'turmas' || pedida === 'demandas' || pedida === 'cursos') {
      void Promise.resolve().then(() => setAba(pedida));
    }
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <GraduationCap className="h-6 w-6 text-psi-vibrant" /> Cursos, turmas e demandas
        </h1>
        <p className="text-xs text-muted">
          Tudo aqui vale sem programação: as permissões de cada curso, as turmas abertas no cadastro, o prazo de saída da vitrine e as demandas clínicas.
        </p>
      </div>

      <div className="-mx-4 flex items-center gap-2 overflow-x-auto border-b border-line px-4 pb-2 sm:mx-0 sm:px-0">
        {ABAS.map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setAba(valor)}
            className={`shrink-0 whitespace-nowrap rounded-2xl px-5 py-2.5 text-xs font-extrabold transition-all ${
              aba === valor ? 'bg-psi-vibrant text-white shadow-md' : 'border border-line bg-surface text-muted hover:bg-slate-100 hover:text-ink'
            }`}
          >
            {rotulo}
          </button>
        ))}
      </div>

      {aba === 'cursos' && <PainelCatalogoCursos />}
      {aba === 'turmas' && <PainelTurmasCursos />}
      {aba === 'demandas' && <PainelDemandas />}
    </div>
  );
}

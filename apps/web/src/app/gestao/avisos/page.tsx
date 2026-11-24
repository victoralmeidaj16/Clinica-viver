'use client';

import { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { PainelModelosAvisos } from '@/components/gestao/avisos/PainelModelosAvisos';
import { PainelEnviosAvisos } from '@/components/gestao/avisos/PainelEnviosAvisos';

type Aba = 'modelos' | 'envios';

const ABAS: ReadonlyArray<[Aba, string]> = [
  ['modelos', 'Mensagens e canais'],
  ['envios', 'Registro de envios'],
];

/**
 * Notificações pela Gestão (especificação final, 12.01, 12.02 e 12.04): textos
 * com campos dinâmicos e versões, canal de cada aviso, ativação dos
 * complementares e o registro de envios com reenvio dos não entregues.
 */
export default function GestaoAvisosPage() {
  const [aba, setAba] = useState<Aba>('modelos');

  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get('aba');
    if (pedida === 'modelos' || pedida === 'envios') void Promise.resolve().then(() => setAba(pedida));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <MessageSquareText className="h-6 w-6 text-psi-vibrant" /> Mensagens e avisos
        </h1>
        <p className="text-xs text-muted">
          O texto de cada aviso, o canal de envio e o histórico do que saiu para pacientes, psicólogos e coordenação.
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

      {aba === 'modelos' && <PainelModelosAvisos />}
      {aba === 'envios' && <PainelEnviosAvisos />}
    </div>
  );
}

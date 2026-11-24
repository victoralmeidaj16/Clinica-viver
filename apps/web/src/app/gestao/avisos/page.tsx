'use client';

import { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { PainelModelosAvisos } from '@/components/gestao/avisos/PainelModelosAvisos';
import { PainelEnviosAvisos } from '@/components/gestao/avisos/PainelEnviosAvisos';
import { AbasSegmentadas } from '@/components/ui/AbasSegmentadas';

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
        <span className="chip-accent mb-1 text-[11px]">Comunicação</span>
        <h1 className="flex items-center gap-2 text-2xl font-black text-ink">
          <MessageSquareText aria-hidden className="h-6 w-6 text-psi-vibrant" /> Mensagens e avisos
        </h1>
        <p className="max-w-3xl text-xs text-muted">
          O texto de cada aviso, o canal de envio e o histórico do que saiu para pacientes, psicólogos e coordenação.
        </p>
      </div>

      <AbasSegmentadas abas={ABAS} ativa={aba} onTrocar={setAba} rotulo="Áreas de mensagens e avisos" />

      <div role="tabpanel" id={`painel-${aba}`} aria-labelledby={`aba-${aba}`}>
        {aba === 'modelos' ? <PainelModelosAvisos /> : <PainelEnviosAvisos />}
      </div>
    </div>
  );
}

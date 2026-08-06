'use client';

import { useEffect, useState } from 'react';
import { FlaskConical } from 'lucide-react';

/**
 * O aviso some sozinho quando a instalação tem banco.
 *
 * Antes ele dependia apenas de `NEXT_PUBLIC_DEMO_MODE`, inlinado no build:
 * bastava esquecer a variável para uma clínica em produção exibir "dados
 * simulados" no topo de todas as telas. A flag continua valendo como
 * desligamento manual; o que mudou é que ela não é mais a única fonte.
 */
export default function DemoNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEMO_MODE === 'false') return;
    let mounted = true;
    fetch('/api/infra/mode', { cache: 'no-store' })
      .then((response) => response.json())
      .then((body: { persistence?: string }) => {
        if (mounted) setVisible(body.persistence !== 'mysql');
      })
      // Sem resposta, o aviso aparece: presumir demonstração é o lado seguro do
      // erro — ele pede para não inserir dado clínico real.
      .catch(() => {
        if (mounted) setVisible(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-8 py-2 text-amber-950">
      <div className="flex items-center justify-center gap-2 text-xs font-semibold">
        <FlaskConical className="h-4 w-4" />
        <span>
          Ambiente de demonstração: dados, IA, armazenamento, pagamentos e mensagens são simulados.
          Não insira dados clínicos reais.
        </span>
      </div>
    </div>
  );
}

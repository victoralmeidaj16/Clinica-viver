import { FlaskConical } from 'lucide-react';

export default function DemoNotice() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'false') return null;

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

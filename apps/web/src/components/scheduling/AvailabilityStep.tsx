import type { ReactNode } from 'react';

export function AvailabilityStep({ id, numero, titulo, opcional, descricao, children }: {
  id: string; numero: number; titulo: string; opcional?: boolean; descricao?: string; children: ReactNode;
}) {
  return (
    <section id={id} className="flex flex-col gap-4 rounded-[20px] border border-line bg-surface p-4 shadow-card sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#B597DA] text-[15px] font-black text-white">{numero}</span>
        <div>
          <h3 className="mt-1.5 text-base font-black text-psi-darkest">
            {titulo} {opcional && <small className="text-[13px] font-semibold text-muted">(opcional)</small>}
          </h3>
          {descricao && <p className="mt-1 text-xs text-muted">{descricao}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

'use client';
import { Building2, UserRound } from 'lucide-react';
export function SessionPayerField({ value, onChange, convenio }: {
  value: boolean; onChange: (value: boolean) => void; convenio: string;
}) {
  return <fieldset className="space-y-2">
    <legend className="text-xs font-bold text-ink">Responsável pelo pagamento</legend>
    <p className="text-[11px] text-muted">Esta escolha vale somente para esta sessão, respeitando a cota do convênio.</p>
    <div className="grid grid-cols-2 gap-2">
      {[true, false].map((empresa) => <button key={String(empresa)} type="button" aria-pressed={value === empresa}
        onClick={() => onChange(empresa)}
        className={`rounded-2xl border px-3 py-2.5 text-xs font-bold ${value === empresa ? 'border-psi-vibrant bg-psi-vibrant/10 text-psi-deep' : 'border-line text-muted'}`}>
        {empresa ? <Building2 className="mr-1.5 inline h-4 w-4" /> : <UserRound className="mr-1.5 inline h-4 w-4" />}
        {empresa ? 'Empresa' : 'Paciente'}
      </button>)}
    </div>
    <p className="text-[11px] text-muted">Convênio: {convenio}</p>
  </fieldset>;
}

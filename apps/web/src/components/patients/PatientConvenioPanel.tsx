'use client';

import { useState } from 'react';
import { Building2 } from 'lucide-react';
import type { ManagedConvenio, ManagedPatient } from './managementTypes';
import type { CusteioCiclo } from '@/lib/convenioBilling';

interface Props {
  patient: ManagedPatient;
  convenios: readonly ManagedConvenio[];
  onConvenioChange: (patientId: string, convenioId: string | null,
    custeadoPelaEmpresa: boolean | null,
    cota: { custeioCota: number | null; custeioCiclo: CusteioCiclo | null }) => Promise<void>;
}

export default function PatientConvenioPanel({ patient, convenios, onConvenioChange }: Props) {
  const [error, setError] = useState('');
  const [convenioId, setConvenioId] = useState(patient?.convenioId ?? '');
  // "Personalizado" não é um quarto valor no banco: é o custeio empresarial com
  // uma cota. Guardá-lo como modo separado só na tela mantém o `custeado_pela_
  // empresa` com os três estados que o resto do sistema já entende.
  const [custeio, setCusteio] = useState<'herdar' | 'sim' | 'nao' | 'personalizado'>(
    patient?.custeioCota !== undefined ? 'personalizado'
      : patient?.custeioConfigurado === undefined ? 'herdar'
        : patient.custeioConfigurado ? 'sim' : 'nao'
  );
  const [cota, setCota] = useState(patient?.custeioCota ? String(patient.custeioCota) : '');
  const [ciclo, setCiclo] = useState<CusteioCiclo>(patient?.custeioCiclo ?? 'total');
  const [savingConvenio, setSavingConvenio] = useState(false);
  const selectedConvenio = convenios.find((item) => item.id === convenioId);

  const cotaNumero = Number(cota);
  const cotaValida = Number.isInteger(cotaNumero) && cotaNumero >= 1 && cotaNumero <= 65535;

  const saveConvenio = async () => {
    if (!patient.patientId) return;
    if (custeio === 'personalizado' && !cotaValida) {
      setError('Informe quantas sessões a empresa cobre (de 1 a 65535).');
      return;
    }
    setSavingConvenio(true); setError('');
    try {
      await onConvenioChange(
        patient.patientId,
        convenioId || null,
        convenioId ? (custeio === 'herdar' ? null : custeio !== 'nao') : null,
        custeio === 'personalizado' && convenioId
          ? { custeioCota: cotaNumero, custeioCiclo: ciclo }
          : { custeioCota: null, custeioCiclo: null },
      );
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao atualizar o convênio.'); }
    finally { setSavingConvenio(false); }
  };

  return <>
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-700" />
              <h3 className="text-sm font-black text-ink">Vínculo com convênio</h3>
            </div>
            {!patient.patientId ? <p className="text-xs text-muted">O vínculo fica disponível depois que a triagem vira paciente.</p> : (
              <div className="space-y-3">
                <select value={convenioId} onChange={(event) => { setConvenioId(event.target.value); setCusteio('herdar'); setCota(''); setCiclo('total'); }} className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-medium text-ink">
                  <option value="">Sem convênio</option>
                  {convenios.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                </select>
                {convenioId && (
                  <label className="block text-xs font-bold text-ink">
                    Quem paga as sessões
                    <select value={custeio} onChange={(event) => setCusteio(event.target.value as typeof custeio)} className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-medium text-ink">
                      <option value="herdar">Padrão do convênio ({selectedConvenio?.empresaPagaSessoes ? 'empresa paga' : 'paciente paga'})</option>
                      <option value="sim">Empresa paga (exceção)</option>
                      <option value="nao">Paciente paga (exceção)</option>
                      <option value="personalizado">Personalizada: empresa cobre uma quantidade</option>
                    </select>
                  </label>
                )}
                {convenioId && custeio === 'personalizado' && (
                  <div className="space-y-3 rounded-xl border border-emerald-200 bg-white p-3">
                    <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
                      <label className="block text-xs font-bold text-ink">
                        Sessões por conta da empresa
                        <input
                          type="number"
                          min={1}
                          max={65535}
                          value={cota}
                          onChange={(event) => setCota(event.target.value)}
                          placeholder="Ex.: 10"
                          className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-medium text-ink"
                        />
                      </label>
                      <label className="block text-xs font-bold text-ink">
                        Contadas
                        <select
                          value={ciclo}
                          onChange={(event) => setCiclo(event.target.value === 'mensal' ? 'mensal' : 'total')}
                          className="mt-1 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-xs font-medium text-ink"
                        >
                          <option value="total">No total do vínculo</option>
                          <option value="mensal">Por mês, renovando</option>
                        </select>
                      </label>
                    </div>
                    <p className="text-[11px] leading-relaxed text-muted">
                      {cotaValida
                        ? ciclo === 'mensal'
                          ? `A empresa paga até ${cotaNumero} ${cotaNumero === 1 ? 'sessão' : 'sessões'} por mês; da seguinte em diante, no mesmo mês, o paciente recebe a cobrança. A cota reabre todo dia 1º.`
                          : `A empresa paga as ${cotaNumero} primeiras sessões; a partir da ${cotaNumero + 1}ª, o paciente recebe a cobrança.`
                        : 'Informe quantas sessões a empresa cobre.'}
                    </p>
                    {/* O consumo é o que a gestão precisa ver antes de mexer na
                        cota: sessão já realizada mantém o pagador que teve. */}
                    {typeof patient.custeioConsumidas === 'number' && patient.custeioCota !== undefined && (
                      <p className="text-[11px] font-bold text-emerald-900">
                        Já usadas {patient.custeioConsumidas} de {patient.custeioCota}
                        {patient.custeioCiclo === 'mensal' ? ' neste mês' : ''}
                        {' · '}
                        {Math.max(0, patient.custeioCota - patient.custeioConsumidas)} restantes
                      </p>
                    )}
                  </div>
                )}
                <button type="button" onClick={() => void saveConvenio()} disabled={savingConvenio} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-xs font-black text-white disabled:opacity-50">
                  {savingConvenio ? 'Salvando…' : 'Salvar vínculo'}
                </button>
              </div>
            )}
          </section>
    {error && <p role="alert" className="text-xs font-semibold text-rose-700">{error}</p>}
  </>;
}

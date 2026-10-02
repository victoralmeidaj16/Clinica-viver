import { DOCUMENT_PURPOSES, PSYCHOLOGICAL_DOCUMENT_LABELS, type PsychologicalDocumentInput } from '@thats-life/core';

export interface DocumentOptions {
  patientName: string;
  professionalName: string;
  crp: string;
  appointments: { id: string; startsAt: string; endsAt: string }[];
}

const fieldClass = 'mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600';

export function DocumentFields({ value, onChange, options, today }: {
  value: PsychologicalDocumentInput;
  onChange: (value: PsychologicalDocumentInput) => void;
  options: DocumentOptions;
  today: string;
}) {
  const set = (field: keyof PsychologicalDocumentInput, next: string) => onChange({ ...value, [field]: next });
  return (
    <div className="space-y-4">
      <label className="block text-sm font-medium">Modelo
        <select className={fieldClass} value={value.kind} onChange={(e) => set('kind', e.target.value)}>
          {Object.entries(PSYCHOLOGICAL_DOCUMENT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium">Local do atendimento e emissão
        <input required maxLength={200} className={fieldClass} value={value.location} onChange={(e) => set('location', e.target.value)} />
      </label>
      {value.kind !== 'referral' && <label className="block text-sm font-medium">Finalidade
        <select className={fieldClass} value={value.purpose} onChange={(e) => set('purpose', e.target.value)}>
          {DOCUMENT_PURPOSES.map((purpose) => <option key={purpose}>{purpose}</option>)}
        </select>
      </label>}
      {value.kind === 'attendance' && <label className="block text-sm font-medium">Atendimento concluído
        <select required className={fieldClass} value={value.appointmentId ?? ''} onChange={(e) => set('appointmentId', e.target.value)}>
          <option value="">Selecione o atendimento</option>
          {options.appointments.map((a) => <option key={a.id} value={a.id}>{new Date(a.startsAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</option>)}
        </select>
      </label>}
      {value.kind === 'followup' && <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block min-w-0 text-sm font-medium">Início do período
          <input required type="date" max={value.endDate || today} className={fieldClass} value={value.startDate ?? ''} onChange={(e) => set('startDate', e.target.value)} />
        </label>
        <label className="block min-w-0 text-sm font-medium">Fim do período
          <input required type="date" min={value.startDate} max={today} className={fieldClass} value={value.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} />
        </label>
      </div>}
      {value.kind === 'referral' && <>
        <label className="block text-sm font-medium">Solicitante
          <input required maxLength={200} className={fieldClass} value={value.requester ?? ''} onChange={(e) => set('requester', e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Destinatário / serviço
          <input required maxLength={200} className={fieldClass} value={value.recipient ?? ''} onChange={(e) => set('recipient', e.target.value)} />
        </label>
        {([
          ['demand', 'Descrição da demanda', 2000], ['procedures', 'Procedimentos', 2000],
          ['analysis', 'Análise', 4000], ['conclusion', 'Conclusão e encaminhamento', 2000],
        ] as const).map(([key, label, maxLength]) => <label key={key} className="block text-sm font-medium">{label}
          <textarea required rows={4} maxLength={maxLength} className={fieldClass} value={value[key] ?? ''} onChange={(e) => set(key, e.target.value)} />
        </label>)}
      </>}
      {value.kind !== 'referral' && options.appointments.length === 0 && <p role="status" className="text-sm text-amber-800">Nenhum atendimento concluído disponível.</p>}
    </div>
  );
}

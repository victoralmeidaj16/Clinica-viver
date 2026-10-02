export const PSYCHOLOGICAL_DOCUMENT_LABELS = {
  attendance: 'Declaração de comparecimento',
  followup: 'Declaração de acompanhamento',
  referral: 'Encaminhamento',
} as const;

export type PsychologicalDocumentKind = keyof typeof PSYCHOLOGICAL_DOCUMENT_LABELS;
export const DOCUMENT_PURPOSES = ['Comprovação de comparecimento', 'Comprovação de acompanhamento', 'Apresentação ao empregador', 'Apresentação à instituição de ensino', 'Solicitação da pessoa atendida'] as const;

export interface PsychologicalDocumentInput {
  kind: PsychologicalDocumentKind;
  purpose: string;
  location: string;
  appointmentId?: string;
  startDate?: string;
  endDate?: string;
  recipient?: string;
  requester?: string;
  demand?: string;
  procedures?: string;
  analysis?: string;
  conclusion?: string;
}

export interface PsychologicalDocumentContent {
  demo?: boolean;
  templateVersion: 1;
  kind: PsychologicalDocumentKind;
  title: string;
  patientName: string;
  professionalName: string;
  crp: string;
  organizationName: string;
  location: string;
  date: string;
  sections: { heading: string; text: string }[];
  appointmentIds: string[];
}

export interface IssuedPsychologicalDocument {
  id: string;
  patientId: string;
  organizationId: string;
  professionalId: string;
  issuedBy: string;
  issuedAt: string;
  requestHash: string;
  content: PsychologicalDocumentContent;
}

export function documentDate(iso: string): string {
  return new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

export function documentDateLabel(date: string): string {
  return date.split('-').reverse().join('/');
}

export function buildPsychologicalDocument(
  input: PsychologicalDocumentInput,
  context: Omit<PsychologicalDocumentContent, 'templateVersion' | 'kind' | 'title' | 'sections' | 'appointmentIds'>,
  appointments: readonly { id: string; startsAt: string; endsAt: string }[],
): PsychologicalDocumentContent {
  let sections: PsychologicalDocumentContent['sections'];
  if (input.kind === 'referral') {
    sections = [
      { heading: '1. Identificação', text: `Pessoa atendida: ${context.patientName}\nSolicitante: ${input.requester}\nDestinatário: ${input.recipient}\nFinalidade: encaminhamento para avaliação ou continuidade do cuidado.\nProfissional: ${context.professionalName} - CRP ${context.crp}` },
      { heading: '2. Descrição da demanda', text: input.demand! },
      { heading: '3. Procedimentos', text: input.procedures! },
      { heading: '4. Análise', text: input.analysis! },
      { heading: '5. Conclusão e encaminhamento', text: input.conclusion! },
    ];
  } else if (input.kind === 'attendance') {
    const appointment = appointments[0];
    const time = (iso: string) => new Date(iso).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
    sections = [{ heading: '', text: `Declaro, para ${input.purpose.toLocaleLowerCase('pt-BR')}, que ${context.patientName} compareceu ao atendimento psicológico em ${documentDateLabel(documentDate(appointment.startsAt))}, das ${time(appointment.startsAt)} às ${time(appointment.endsAt)}${documentDate(appointment.startsAt) !== documentDate(appointment.endsAt) ? ` de ${documentDateLabel(documentDate(appointment.endsAt))}` : ''}, em ${input.location}, sob meus cuidados profissionais.` }];
  } else {
    const first = documentDateLabel(documentDate(appointments[0].startsAt));
    const last = documentDateLabel(documentDate(appointments[appointments.length - 1].startsAt));
    sections = [{ heading: '', text: `Declaro, para ${input.purpose.toLocaleLowerCase('pt-BR')}, que ${context.patientName} realizou acompanhamento psicológico sob meus cuidados profissionais, em ${input.location}, no período de ${first} a ${last}, com ${appointments.length} atendimento(s) registrado(s).` }];
  }
  return { ...context, templateVersion: 1, kind: input.kind, title: input.kind === 'referral' ? 'Relatório psicológico - encaminhamento' : 'Declaração', sections, appointmentIds: appointments.map((a) => a.id) };
}

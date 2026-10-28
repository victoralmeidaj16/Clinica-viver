'use client';

import { useState } from 'react';
import { applicationRequest, commandHeaders } from '@/lib/applicationApi';
import { civilDaysBetween, clinicDateTimeToIso, manualAppointmentTimes, shiftCivilDate, type ManualAppointmentMode } from '@/lib/manualAppointment';
import { FUSO_CLINICA } from '@/lib/sessionReference';

interface Input {
  patientId: string;
  professionalId?: string;
  adminMode: boolean;
  recurrenceDates: string[];
  date: string;
  time: string;
  durationMinutes: number;
  validDuration: boolean;
  chargeDueDate: string;
  chargeDueTime: string;
  mode: ManualAppointmentMode;
  serviceKey: string;
  onScheduled?: () => void | Promise<void>;
}

export function useManualAppointmentSubmission({ patientId, professionalId, adminMode, recurrenceDates, date, time,
  durationMinutes, validDuration, chargeDueDate, chargeDueTime, mode, serviceKey, onScheduled }: Input) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'error' | 'success' | 'warning'; text: string }>();
  // Cada ocorrência mantém id e chave enquanto o formulário estiver aberto. Uma
  // nova tentativa após falha pula as já gravadas e reenvia a que falhou com a
  // mesma chave, para o servidor reconhecer o replay se ela chegou a ser salva.
  const [series] = useState(() => new Map<string, { id: string; headers: Record<string, string>; created?: boolean }>());
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(undefined);
    if (!recurrenceDates.length) {
      setMessage({ kind: 'error', text: 'Selecione pelo menos um dia no calendário.' });
      return;
    }
    if (!patientId) {
      setMessage({ kind: 'error', text: 'Selecione um paciente para continuar.' });
      return;
    }
    if (adminMode && !professionalId) {
      setMessage({
        kind: 'error',
        text: 'O paciente selecionado precisa ter um psicólogo atribuído para agendar o atendimento.',
      });
      return;
    }
    if (!validDuration) {
      setMessage({ kind: 'error', text: 'Informe a duração da sessão, entre 15 e 240 minutos.' });
      return;
    }
    if (recurrenceDates.some((d) => Date.parse(manualAppointmentTimes({ date: d, time, durationMinutes }).startsAt) <= Date.now())) {
      setMessage({ kind: 'error', text: 'O horário da sessão deve estar no futuro.' });
      return;
    }
    setSaving(true);
    let createdCount = 0;
    let failedCharges = 0;
    try {
      for (const occurrenceDate of recurrenceDates) {
        const { startsAt, endsAt } = manualAppointmentTimes({ date: occurrenceDate, time, durationMinutes });
        const occurrenceKey = [patientId, professionalId ?? '', serviceKey, mode, startsAt, endsAt].join('|');
        let occurrence = series.get(occurrenceKey);
        if (!occurrence) {
          occurrence = { id: `appointment-manual-${crypto.randomUUID()}`, headers: commandHeaders() };
          series.set(occurrenceKey, occurrence);
        }
        if (occurrence.created) {
          createdCount += 1;
          continue;
        }
        const dayOffset = civilDaysBetween(date, occurrenceDate);
        const occurrenceDueDate = shiftCivilDate(chargeDueDate, dayOffset);
        const result = await applicationRequest<{ charge: { status: string } }>('/appointments', {
          method: 'POST',
          headers: occurrence.headers,
          body: JSON.stringify({
            id: occurrence.id,
            patientId,
            ...(professionalId
              ? { professionalId }
              : {}),
            startsAt,
            endsAt,
            timezone: FUSO_CLINICA,
            mode,
            createdAt: new Date().toISOString(),
            serviceKey,
            chargeDueAt: clinicDateTimeToIso(occurrenceDueDate, chargeDueTime),
          }),
        });
        occurrence.created = true;
        createdCount += 1;
        if (result.charge?.status === 'failed') failedCharges += 1;
      }
      setMessage({
        kind: failedCharges ? 'warning' : 'success',
        text: failedCharges
          ? `${createdCount} atendimento(s) agendado(s). ${failedCharges} cobrança(s) ainda não foram geradas e aguardam nova tentativa. Não repita o agendamento.`
          : `${createdCount} ${createdCount === 1 ? 'atendimento adicionado' : 'atendimentos adicionados'} à agenda com sucesso.`,
      });
      await onScheduled?.();
    } catch (error) {
      if (createdCount > 0) await onScheduled?.();
      setMessage({
        kind: 'error',
        text: `${createdCount > 0 ? `${createdCount} de ${recurrenceDates.length} atendimento(s) foram criados; tentar de novo envia só os restantes. ` : ''}${error instanceof Error ? error.message : 'Não foi possível criar o agendamento.'}`,
      });
    } finally {
      setSaving(false);
    }
  };

  return { submit, saving, message, completed: message?.kind === 'success' || message?.kind === 'warning' };
}

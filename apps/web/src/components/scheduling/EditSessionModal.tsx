'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  CalendarDays,
  AlertCircle,
  Loader2,
  X,
  Pencil,
} from 'lucide-react';
import { clinicDateTimeToIso } from '@/lib/manualAppointment';
import { applicationRequest } from '@/lib/applicationApi';
import { EditSessionFields } from './EditSessionFields';
import { SessionPayerField } from './SessionPayerField';

export interface SessionEditableData {
  id: string;
  pacienteNome: string;
  inicio: string;
  fim?: string;
  modalidade?: 'online' | 'presencial' | 'telefone';
  status?: string;
  custeadoPelaEmpresa?: boolean;
  convenioNome?: string;
}

interface Props {
  admin?: boolean;
  session?: SessionEditableData;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}

const FORMATTER = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
});

function camposIniciais(session: SessionEditableData) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(session.inicio))
      .map((p) => [p.type, p.value])
  );
  const dur = session.fim
    ? Math.round((new Date(session.fim).getTime() - new Date(session.inicio).getTime()) / 60_000)
    : 50;
  return {
    data: `${parts.year}-${parts.month}-${parts.day}`,
    hora: `${parts.hour}:${parts.minute}`,
    duracaoMin: dur > 0 ? dur : 50,
    modalidade: session.modalidade === 'presencial' ? ('presencial' as const) : ('online' as const),
    status:
      session.status === 'realizado' || session.status === 'completed'
        ? ('realizado' as const)
        : ('agendado' as const),
  };
}

export function EditSessionModal({ session, isOpen, onClose, onSaved, admin = false }: Props) {
  if (!isOpen || !session) return null;
  return <FormularioEdicao admin={admin} session={session} onClose={onClose} onSaved={onSaved} />;
}

function FormularioEdicao({
  admin,
  session,
  onClose,
  onSaved,
}: {
  admin: boolean;
  session: SessionEditableData;
  onClose: () => void;
  onSaved: Props['onSaved'];
}) {
  // Calculados uma vez por montagem: daqui em diante o formulário é do usuário.
  const [iniciais] = useState(() => camposIniciais(session));
  const [data, setData] = useState(iniciais.data);
  const [hora, setHora] = useState(iniciais.hora);
  const [duracaoMin, setDuracaoMin] = useState(iniciais.duracaoMin);
  const [modalidade, setModalidade] = useState<'online' | 'presencial'>(iniciais.modalidade);
  const [status, setStatus] = useState<'agendado' | 'realizado'>(iniciais.status);
  const [pagadorEmpresa, setPagadorEmpresa] = useState(Boolean(session.custeadoPelaEmpresa));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // A lista deriva "realizado" de qualquer sessão já passada, mesmo sem
  // confirmação. Só mandamos o status quando o usuário realmente o altera —
  // do contrário, salvar um ajuste de horário confirmaria a realização sozinho.
  const statusInicial = iniciais.status;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data || !hora) {
      setError('Selecione a data e o horário.');
      return;
    }

    const startsAtIso = clinicDateTimeToIso(data, hora);
    const startsAtDate = new Date(startsAtIso);
    if (isNaN(startsAtDate.getTime())) {
      setError('Data ou horário inválido.');
      return;
    }

    const endsAtDate = new Date(startsAtDate.getTime() + duracaoMin * 60_000);
    const endsAtIso = endsAtDate.toISOString();

    setLoading(true);
    setError(undefined);
    try {
      await applicationRequest(
        `${admin ? '/gestao/agenda' : '/agenda/agendamentos'}/${encodeURIComponent(session.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            action: 'edit',
            startsAt: startsAtIso,
            endsAt: endsAtIso,
            modalidade: modalidade === iniciais.modalidade ? undefined : modalidade,
            custeadoPelaEmpresa: admin && session.convenioNome && pagadorEmpresa !== Boolean(session.custeadoPelaEmpresa)
              ? pagadorEmpresa : undefined,
            status: status === statusInicial ? undefined : status,

          }),
        }
      );
      await onSaved();
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar as alterações da sessão.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="max-h-[92dvh] w-full max-w-md space-y-5 overflow-y-auto rounded-3xl border border-line bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-psi-vibrant/10 text-psi-vibrant flex items-center justify-center">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-ink">Editar Atendimento</h2>
              <p className="text-xs text-muted">{admin ? 'Ajuste horário, modalidade, pagamento ou status' : 'Ajuste horário, modalidade ou status'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-muted hover:text-ink hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Card do Paciente */}
        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-muted tracking-wider">
              Paciente
            </span>
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                session.status === 'realizado'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-sky-200 bg-sky-50 text-sky-800'
              }`}
            >
              {session.status === 'realizado' ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Realizado
                </>
              ) : (
                <>
                  <CalendarDays className="w-3 h-3" /> Agendado
                </>
              )}
            </span>
          </div>
          <p className="text-sm font-extrabold text-ink">{session.pacienteNome}</p>
          <p className="text-xs text-slate-600 capitalize">
            {FORMATTER.format(new Date(session.inicio))}
          </p>
        </div>

        {error && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-800 text-xs font-semibold">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <EditSessionFields
            data={data} hora={hora} duracaoMin={duracaoMin} modalidade={modalidade} status={status}
            setData={setData} setHora={setHora} setDuracaoMin={setDuracaoMin} setModalidade={setModalidade} setStatus={setStatus}
          />

          {admin && session.convenioNome && status !== 'realizado' && <SessionPayerField
            value={pagadorEmpresa} onChange={setPagadorEmpresa} convenio={session.convenioNome} />}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-muted hover:text-ink hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-accent px-5 py-2.5 text-xs font-bold flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Salvando...
                </>
              ) : (
                'Salvar Alterações'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Loader2, UserX } from 'lucide-react';
import { faltaCobrada, possuiPagamento } from '@/lib/appointmentWorkflow';

export interface NoShowSession {
  pacienteNome: string;
  inicio: string;
  status: string;
  pagamentoStatus?: string;
  custeadoPelaEmpresa: boolean;
  convenioNome?: string;
}

interface Props {
  session: NoShowSession;
  /** `falhou` indica que a falta pode ter sido gravada sem o financeiro concluir. */
  onClose: (falhou: boolean) => void;
  onConfirm: (cobrar: boolean) => Promise<void>;
}

const FORMATO = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

/** Registra a falta exigindo uma escolha explícita: nenhuma cobrança nasce de um clique distraído. */
export function NoShowDialog({ session, onClose, onConfirm }: Props) {
  const jaRegistrada = session.status === 'faltou';
  const pago = possuiPagamento(session.pagamentoStatus);
  const [cobrar, setCobrar] = useState<boolean | undefined>(
    pago ? true : jaRegistrada ? faltaCobrada(session.pagamentoStatus) : undefined
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (cobrar === undefined) return;
    setSalvando(true);
    setErro(undefined);
    try {
      await onConfirm(cobrar);
      onClose(false);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Não foi possível registrar a falta.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <form onSubmit={salvar} className="w-full max-w-md space-y-4 rounded-3xl border border-line bg-surface p-6 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><UserX className="h-5 w-5" /></div>
          <div>
            <h2 className="text-base font-black text-ink">{jaRegistrada ? 'Cobrança da falta' : 'Registrar falta'}</h2>
            <p className="text-xs text-muted">{session.pacienteNome} · {FORMATO.format(new Date(session.inicio))}</p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-bold text-ink">Esta sessão será cobrada do paciente? *</legend>
          <label className={`flex cursor-pointer gap-2.5 rounded-2xl border p-3 text-xs ${cobrar === true ? 'border-amber-300 bg-amber-50' : 'border-line bg-white'}`}>
            <input type="radio" name="cobranca-falta" required checked={cobrar === true} onChange={() => setCobrar(true)} />
            <span><strong className="block text-ink">Cobrar a sessão</strong><span className="text-muted">
              {pago ? 'O pagamento já registrado é mantido.' : 'Mantém ou cria a cobrança e o link de pagamento do paciente. Se o prazo já tiver passado, ele vence em 3 dias.'}
            </span></span>
          </label>
          <label className={`flex gap-2.5 rounded-2xl border p-3 text-xs ${pago ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} ${cobrar === false ? 'border-sky-300 bg-sky-50' : 'border-line bg-white'}`}>
            <input type="radio" name="cobranca-falta" disabled={pago} checked={cobrar === false} onChange={() => setCobrar(false)} />
            <span><strong className="block text-ink">Não cobrar</strong><span className="text-muted">
              {pago ? 'Indisponível: a sessão já tem pagamento registrado.' : 'Cancela a cobrança pendente e desativa o link de pagamento.'}
            </span></span>
          </label>
        </fieldset>

        {session.custeadoPelaEmpresa && (
          <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-[11px] text-sky-900">
            Sessão custeada por {session.convenioNome ?? 'empresa'}: a falta não entra na fatura nem consome a cota. Se cobrar, a cobrança vai para o paciente.
          </p>
        )}
        {!jaRegistrada && <p className="text-[11px] text-muted">O paciente não recebe aviso automático. A falta não poderá ser desfeita depois de registrada.</p>}
        {erro && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-[11px] font-bold text-rose-700">{erro}</p>}

        <div className="flex gap-2">
          <button type="button" disabled={salvando} onClick={() => onClose(Boolean(erro))} className="btn-outline flex-1 justify-center text-xs">Voltar</button>
          <button type="submit" disabled={salvando || cobrar === undefined} className="btn-primary flex-1 justify-center text-xs disabled:opacity-50">
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : jaRegistrada ? 'Salvar decisão' : 'Registrar falta'}
          </button>
        </div>
      </form>
    </div>
  );
}

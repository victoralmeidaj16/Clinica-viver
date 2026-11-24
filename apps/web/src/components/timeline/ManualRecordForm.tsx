'use client';

import { FileText, Save } from 'lucide-react';
import type { RascunhoProntuario } from './fichaAtiva';

type CampoDeTexto = Exclude<keyof RascunhoProntuario, 'patientId'>;

const CAMPOS_SOAP: readonly { campo: CampoDeTexto; rotulo: string; dica: string }[] = [
  { campo: 'subjetivo', rotulo: 'Subjetivo (Relato do Paciente)', dica: 'Queixas, sentimentos e relato trazido pelo paciente...' },
  { campo: 'objetivo', rotulo: 'Objetivo (Observações do Psicólogo)', dica: 'Comportamentos observados, afeto, linguagem não verbal...' },
  { campo: 'avaliacao', rotulo: 'Avaliação (Análise Clínica)', dica: 'Impressões clínicas, hipóteses diagnósticas, avanços...' },
  { campo: 'plano', rotulo: 'Plano (Conduta & Próximos Passos)', dica: 'Tarefas combinadas, meta para a próxima sessão...' },
];

interface ManualRecordFormProps {
  /** Nome do paciente do rascunho — a ficha em que ele será gravado. */
  patientName: string;
  rascunho: RascunhoProntuario;
  onChange: (rascunho: RascunhoProntuario) => void;
  onCancel: () => void;
  onSubmit: (event: React.FormEvent) => void;
  salvando: boolean;
  erro?: string;
  /** Vínculo encerrado: o autor só acrescenta complemento (especificação final, § 8.05). */
  complemento?: boolean;
}

/** Formulário do prontuário manual. Grava sempre no paciente do rascunho. */
export function ManualRecordForm({ patientName, rascunho, onChange, onCancel, onSubmit, salvando, erro, complemento = false }: ManualRecordFormProps) {
  const alterar = (campo: CampoDeTexto, valor: string) => onChange({ ...rascunho, [campo]: valor });

  return (
    <form
      onSubmit={onSubmit}
      className="animate-in space-y-4 rounded-3xl border border-line bg-white p-4 shadow-card fade-in duration-200 sm:p-6"
    >
      <div className="flex flex-col gap-3 border-b border-line pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <FileText className="w-5 h-5 text-psi-vibrant" />
          <div className="min-w-0">
            <h3 className="break-words font-extrabold text-base text-ink">
              {complemento ? 'Complemento ao Prontuário' : 'Novo Registro de Prontuário Manual'} — {patientName}
            </h3>
            {complemento && (
              <p className="mt-0.5 text-xs text-muted">
                O registro original não é alterado. O complemento fica datado e só você o vê.
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 self-start rounded-xl px-3 text-xs font-bold text-muted hover:bg-canvas hover:text-ink sm:self-auto"
        >
          Cancelar
        </button>
      </div>

      <div>
        <label className="text-xs font-bold text-ink block mb-1">Título do Atendimento / Prontuário</label>
        <input
          type="text"
          required
          value={rascunho.titulo}
          onChange={(e) => alterar('titulo', e.target.value)}
          placeholder="Ex: Sessão Semanal TCC, Anamnese Inicial..."
          className="input py-2.5 text-xs w-full"
        />
      </div>

      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-psi-vibrant">
          Anotações &amp; Evolução Clínica Manual
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CAMPOS_SOAP.map(({ campo, rotulo, dica }) => (
            <div key={campo}>
              <label className="text-[11px] font-bold text-ink block mb-1">{rotulo}</label>
              <textarea
                rows={3}
                value={rascunho[campo]}
                onChange={(e) => alterar(campo, e.target.value)}
                placeholder={dica}
                className="input py-2 text-xs w-full resize-none"
              />
            </div>
          ))}
        </div>
      </div>

      {erro && (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">{erro}</p>
      )}

      <div className="grid grid-cols-1 gap-2 pt-2 sm:flex sm:justify-end">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl px-4 py-2 text-xs font-bold text-muted hover:bg-canvas">
          Cancelar
        </button>
        <button type="submit" disabled={salvando} className="btn-accent min-h-11 justify-center px-5 py-2 text-xs shadow-md">
          <Save className="w-4 h-4" />
          {salvando ? 'Salvando…' : 'Salvar no Prontuário'}
        </button>
      </div>
    </form>
  );
}

interface RascunhoPendenteAvisoProps {
  patientName: string;
  onVoltar: () => void;
  onDescartar: () => void;
}

/** Rascunho começado em outra ficha: nunca é levado para a ficha aberta. */
export function RascunhoPendenteAviso({ patientName, onVoltar, onDescartar }: RascunhoPendenteAvisoProps) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
      <p className="font-bold">
        Há um rascunho de prontuário não salvo de {patientName}. Ele só pode ser salvo na ficha dessa pessoa.
      </p>
      <div className="flex shrink-0 gap-2">
        <button type="button" onClick={onVoltar} className="min-h-11 rounded-xl bg-amber-600 px-3 font-extrabold text-white hover:bg-amber-700">
          Voltar para a ficha
        </button>
        <button type="button" onClick={onDescartar} className="min-h-11 rounded-xl border border-amber-300 px-3 font-bold hover:bg-amber-100">
          Descartar rascunho
        </button>
      </div>
    </div>
  );
}

import { useEffect, useId, useRef, useState } from 'react';

const MOTIVOS = ['Férias', 'Limite de pacientes', 'Pausa solicitada', 'Licença', 'Outro'];

export function ModalMotivo({
  nome,
  onConfirmar,
  onCancelar,
}: {
  nome: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [escolha, setEscolha] = useState(MOTIVOS[0]);
  const [outro, setOutro] = useState('');
  const motivo = escolha === 'Outro' ? outro.trim() : escolha;
  const dialog = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  useEffect(() => {
    const elemento = dialog.current;
    elemento?.showModal();
    return () => elemento?.close();
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={tituloId}
      onCancel={(event) => { event.preventDefault(); onCancelar(); }}
      className="m-auto w-[calc(100%_-_2rem)] max-w-md space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl backdrop:bg-slate-950/60 backdrop:backdrop-blur-sm"
    >
      <div>
        <h2 id={tituloId} className="text-lg font-black text-slate-900">
          Pausar rodízio
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {nome} deixará de receber novos encaminhamentos enquanto a pausa estiver ativa.
        </p>
      </div>

      <fieldset className="min-w-0 space-y-2">
        <legend className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
          Motivo
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {MOTIVOS.map((opcao) => (
            <button
              key={opcao}
              type="button"
              aria-pressed={escolha === opcao}
              onClick={() => setEscolha(opcao)}
              className={`px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                escolha === opcao
                  ? 'bg-purple-50 border-purple-500 text-purple-900'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {opcao}
            </button>
          ))}
        </div>
        {escolha === 'Outro' && (
          <input
            autoFocus
            aria-label="Motivo da pausa"
            maxLength={255}
            value={outro}
            onChange={(e) => setOutro(e.target.value)}
            placeholder="Qual o motivo?"
            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-600"
          />
        )}
      </fieldset>

      <div className="flex gap-2 pt-2 border-t border-slate-100">
        <button
          type="button"
          disabled={!motivo}
          onClick={() => onConfirmar(motivo)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs px-5 py-2.5 rounded-2xl disabled:opacity-50"
        >
          Confirmar
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="border border-slate-200 text-slate-600 font-extrabold text-xs px-5 py-2.5 rounded-2xl hover:bg-slate-50"
        >
          Cancelar
        </button>
      </div>
    </dialog>
  );
}

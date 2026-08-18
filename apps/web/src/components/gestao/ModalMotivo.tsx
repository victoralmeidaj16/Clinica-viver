import React, { useState } from 'react';
import { PsicologoItem } from './types';

const MOTIVOS = ['Férias', 'Limite de pacientes', 'Pausa solicitada', 'Licença', 'Outro'];

export function ModalMotivo({
  alvo,
  onConfirmar,
  onCancelar,
}: {
  alvo: { psicologo: PsicologoItem; acao: 'VITRINE' | 'RODIZIO' };
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
}) {
  const [escolha, setEscolha] = useState(MOTIVOS[0]);
  const [outro, setOutro] = useState('');
  const motivo = escolha === 'Outro' ? outro.trim() : escolha;
  const nome = alvo.psicologo.nomeSocial?.trim() || alvo.psicologo.nomeCompleto;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 border border-slate-200 shadow-2xl">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            {alvo.acao === 'VITRINE' ? 'Tirar do site público' : 'Pausar encaminhamentos'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            {alvo.acao === 'VITRINE'
              ? `${nome} deixa de aparecer na vitrine, mas continua recebendo pacientes novos.`
              : `${nome} para de receber pacientes novos, mas segue visível para quem já atende.`}
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 block">
            Motivo
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MOTIVOS.map((opcao) => (
              <button
                key={opcao}
                type="button"
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
              value={outro}
              onChange={(e) => setOutro(e.target.value)}
              placeholder="Qual o motivo?"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:outline-none focus:border-purple-600"
            />
          )}
        </div>

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
      </div>
    </div>
  );
}

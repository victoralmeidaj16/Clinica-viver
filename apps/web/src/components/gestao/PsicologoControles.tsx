import { useState } from 'react';
import { Eye, EyeOff, PauseCircle, PlayCircle } from 'lucide-react';
import { ModalMotivo } from './ModalMotivo';
import { TAG_NEUTRA, COR_ICONE } from './TagStatus';
import type { PsicologoItem } from './types';

export type AtualizarControlesPsicologo = (id: string, mudancas: Partial<Pick<PsicologoItem,
  'exibirNaVitrine' | 'pausadoNoRodizio' | 'motivoPausaRodizio'>>) => void;

interface Props {
  p: Pick<PsicologoItem, 'id' | 'nomeCompleto' | 'nomeSocial' | 'exibirNaVitrine' | 'pausadoNoRodizio'>;
  trabalhando: boolean;
  onAtualizar: AtualizarControlesPsicologo;
}

export function PsicologoVisibilidadeVitrine({ p, trabalhando, onAtualizar }: Props) {
  const habilitada = p.exibirNaVitrine !== false;
  const Icone = habilitada ? Eye : EyeOff;
  const acao = habilitada ? 'Ocultar da vitrine' : 'Exibir na vitrine';
  return (
    <button
      type="button"
      disabled={trabalhando}
      onClick={(event) => { event.stopPropagation(); onAtualizar(p.id, { exibirNaVitrine: !habilitada }); }}
      title={acao}
      aria-label={acao}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold hover:bg-slate-50 disabled:opacity-50 ${TAG_NEUTRA}`}
    >
      <Icone aria-hidden className={`h-3 w-3 shrink-0 ${habilitada ? COR_ICONE.marca : COR_ICONE.neutro}`} />
      {habilitada ? 'Vitrine habilitada' : 'Vitrine oculta'}
    </button>
  );
}

export function PsicologoPausaRodizio({ p, trabalhando, onAtualizar }: Props) {
  const [pedirMotivo, setPedirMotivo] = useState(false);
  const pausado = p.pausadoNoRodizio === true;
  const acao = pausado ? 'Retomar rodízio' : 'Pausar rodízio';
  return (
    <>
      <button
        type="button"
        disabled={trabalhando}
        onClick={() => {
          if (pausado) onAtualizar(p.id, { pausadoNoRodizio: false });
          else setPedirMotivo(true);
        }}
        title={acao}
        aria-label={acao}
        aria-haspopup={pausado ? undefined : 'dialog'}
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition-all disabled:opacity-50 ${
          pausado
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {pausado ? <PlayCircle aria-hidden className="h-3.5 w-3.5" /> : <PauseCircle aria-hidden className="h-3.5 w-3.5" />}
        {pausado ? 'Retomar' : 'Pausar'}
      </button>
      {pedirMotivo && (
        <ModalMotivo
          nome={p.nomeSocial?.trim() || p.nomeCompleto}
          onConfirmar={(motivo) => {
            setPedirMotivo(false);
            onAtualizar(p.id, { pausadoNoRodizio: true, motivoPausaRodizio: motivo });
          }}
          onCancelar={() => setPedirMotivo(false)}
        />
      )}
    </>
  );
}

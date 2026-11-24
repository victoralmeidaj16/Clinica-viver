'use client';

import { useState } from 'react';
import { Settings } from 'lucide-react';
import type { AvisosTurma, PrazoSaidaTurma } from '@/lib/turmasCiclo';
import { chamarGestao } from '@/components/gestao/gestaoApi';

const campo = 'mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink focus:border-psi-vibrant focus:outline-none';

/**
 * Prazo de saída da vitrine e avisos da contagem (especificação final, 1.02 e
 * 1.03), configuráveis sem programação. Marcadores nos textos: {turma},
 * {curso}, {encerramento}, {saida} e {restante}.
 */
export function ConfigSaidaTurmas({ prazo, avisos, onSalvo }: {
  prazo: PrazoSaidaTurma;
  avisos: AvisosTurma;
  onSalvo: () => Promise<void>;
}) {
  const [quantidade, setQuantidade] = useState(String(prazo.quantidade));
  const [unidade, setUnidade] = useState(prazo.unidade);
  const [dias, setDias] = useState(avisos.diasAntes.join(', '));
  const [textoPsicologo, setTextoPsicologo] = useState(avisos.textoPsicologo);
  const [textoGestao, setTextoGestao] = useState(avisos.textoGestao);
  const [whatsapp, setWhatsapp] = useState(avisos.enviarWhatsApp);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();

  const salvar = async () => {
    setSalvando(true);
    setMensagem(undefined);
    try {
      await chamarGestao('/api/application/gestao/turmas', {
        prazo: { quantidade: Number(quantidade), unidade },
        avisos: {
          diasAntes: dias.split(/[,;\s]+/).filter(Boolean).map(Number),
          textoPsicologo, textoGestao, enviarWhatsApp: whatsapp,
        },
      }, 'PUT');
      setMensagem({ tipo: 'ok', texto: 'Configuração salva. As datas de saída foram recalculadas.' });
      await onSalvo();
    } catch (causa) {
      setMensagem({ tipo: 'erro', texto: causa instanceof Error ? causa.message : 'Falha ao salvar.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <details className="rounded-3xl border border-line bg-surface p-5 shadow-card">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-extrabold text-ink">
        <Settings className="h-4 w-4 text-psi-vibrant" /> Prazo de saída e avisos
        <span className="text-xs font-semibold text-muted">— {prazo.quantidade} {prazo.unidade === 'MESES' ? 'meses' : 'dias'} após o encerramento</span>
      </summary>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-[11px] font-bold text-muted">Prazo
          <input type="number" min={0} value={quantidade} onChange={(event) => setQuantidade(event.target.value)} className={campo} />
        </label>
        <label className="text-[11px] font-bold text-muted">Contagem
          <select value={unidade} onChange={(event) => setUnidade(event.target.value as PrazoSaidaTurma['unidade'])} className={campo}>
            <option value="MESES">Meses do calendário</option>
            <option value="DIAS">Dias corridos</option>
          </select>
        </label>
        <label className="text-[11px] font-bold text-muted sm:col-span-2">Avisar quantos dias antes da saída (separados por vírgula)
          <input value={dias} onChange={(event) => setDias(event.target.value)} className={campo} />
        </label>
        <label className="text-[11px] font-bold text-muted sm:col-span-2">Texto ao psicólogo
          <textarea rows={3} value={textoPsicologo} onChange={(event) => setTextoPsicologo(event.target.value)} className={campo} />
        </label>
        <label className="text-[11px] font-bold text-muted sm:col-span-2">Texto à Gestão
          <textarea rows={2} value={textoGestao} onChange={(event) => setTextoGestao(event.target.value)} className={campo} />
        </label>
        <p className="text-[11px] text-muted sm:col-span-2">Marcadores: {'{turma}'}, {'{curso}'}, {'{encerramento}'}, {'{saida}'} e {'{restante}'}.</p>
        <label className="flex items-center gap-2 text-xs font-semibold text-ink sm:col-span-2">
          <input type="checkbox" checked={whatsapp} onChange={(event) => setWhatsapp(event.target.checked)} />
          Enviar também por WhatsApp ao psicólogo em cada aviso (o sino sempre mostra)
        </label>
      </div>
      {mensagem && <p className={`mt-3 text-xs font-semibold ${mensagem.tipo === 'ok' ? 'text-emerald-700' : 'text-rose-700'}`}>{mensagem.texto}</p>}
      <button type="button" disabled={salvando} onClick={() => void salvar()} className="btn-primary mt-3 min-h-10 justify-center disabled:opacity-50">
        {salvando ? 'Salvando…' : 'Salvar configuração'}
      </button>
    </details>
  );
}

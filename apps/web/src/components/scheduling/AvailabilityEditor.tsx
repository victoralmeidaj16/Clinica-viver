'use client';

import { useState } from 'react';
import { Clock, Plus, Save, Trash2, Layers, CheckSquare, Sparkles } from 'lucide-react';

export interface JanelaEditavel {
  diaSemana: number;
  horaInicio: string;
  horaFim: string;
  duracaoMin: number;
  modalidade: 'presencial' | 'online';
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const NOVA_JANELA: JanelaEditavel = {
  diaSemana: 1,
  horaInicio: '08:00',
  horaFim: '12:00',
  duracaoMin: 50,
  modalidade: 'online',
};

interface Props {
  janelas: readonly JanelaEditavel[];
  onSalvar: (janelas: JanelaEditavel[]) => Promise<void>;
}

export function AvailabilityEditor({ janelas, onSalvar }: Props) {
  const [rascunho, setRascunho] = useState<JanelaEditavel[]>([...janelas]);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; texto: string }>();

  // Estado para Edição / Criação em Lote
  const [mostrarLote, setMostrarLote] = useState(false);
  const [diasSelecionadosLote, setDiasSelecionadosLote] = useState<number[]>([1, 2, 3, 4, 5]); // Seg a Sex por padrão
  const [loteHoraInicio, setLoteHoraInicio] = useState('08:00');
  const [loteHoraFim, setLoteHoraFim] = useState('18:00');
  const [loteDuracao, setLoteDuracao] = useState(50);
  const [loteModalidade, setLoteModalidade] = useState<'online' | 'presencial'>('online');

  const alterar = (indice: number, campo: Partial<JanelaEditavel>) =>
    setRascunho((atual) => atual.map((item, i) => (i === indice ? { ...item, ...campo } : item)));

  const alternarDiaLote = (diaNum: number) => {
    setDiasSelecionadosLote((prev) =>
      prev.includes(diaNum) ? prev.filter((d) => d !== diaNum) : [...prev, diaNum]
    );
  };

  const selecionarDiasUteis = () => setDiasSelecionadosLote([1, 2, 3, 4, 5]);
  const selecionarTodosDias = () => setDiasSelecionadosLote([0, 1, 2, 3, 4, 5, 6]);

  const aplicarLote = () => {
    if (diasSelecionadosLote.length === 0) {
      setAviso({ tipo: 'erro', texto: 'Selecione pelo menos um dia para aplicar em lote.' });
      return;
    }

    // Cria novas janelas para cada dia selecionado no lote
    const novasJanelasLote: JanelaEditavel[] = diasSelecionadosLote.map((diaSemana) => ({
      diaSemana,
      horaInicio: loteHoraInicio,
      horaFim: loteHoraFim,
      duracaoMin: loteDuracao,
      modalidade: loteModalidade,
    }));

    // Remove janelas antigas dos dias selecionados para substituir pelas novas do lote
    const rascunhoFiltrado = rascunho.filter((j) => !diasSelecionadosLote.includes(j.diaSemana));
    const rascunhoAtualizado = [...rascunhoFiltrado, ...novasJanelasLote].sort(
      (a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio)
    );

    setRascunho(rascunhoAtualizado);
    setAviso({
      tipo: 'ok',
      texto: `Grade configurada em lote para ${diasSelecionadosLote.length} dia(s). Clique em "Salvar grade" para publicar.`,
    });
    setMostrarLote(false);
  };

  const salvar = async () => {
    setSalvando(true);
    setAviso(undefined);
    try {
      await onSalvar(rascunho);
      setAviso({ tipo: 'ok', texto: 'Grade publicada com sucesso! O link do paciente já mostra os novos horários.' });
    } catch (causa) {
      setAviso({ tipo: 'erro', texto: causa instanceof Error ? causa.message : 'Não foi possível salvar a grade.' });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="bg-surface rounded-3xl border border-line shadow-card overflow-hidden space-y-0">
      {/* Header com Branding Viver Mais */}
      <div className="p-6 border-b border-line bg-gradient-to-r from-slate-900 to-psi-darkest text-white flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-psi-vibrant bg-psi-vibrant/20 px-2.5 py-1 rounded-full border border-psi-vibrant/30">
            Grade Semanal de Atendimento
          </span>
          <h3 className="font-extrabold text-lg text-white flex items-center gap-2 mt-1">
            <Clock className="w-5 h-5 text-psi-vibrant" /> Horários que você atende
          </h3>
          <p className="text-xs text-slate-300">
            Defina os períodos disponíveis na semana. Cada janela vira horários agendáveis para o paciente.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarLote(!mostrarLote)}
            className="rounded-2xl border border-psi-vibrant/40 bg-psi-vibrant/20 hover:bg-psi-vibrant/30 px-3.5 py-2.5 text-xs font-bold text-psi-soft flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-4 h-4 text-psi-vibrant" />
            <span>Configurar em Lote</span>
          </button>

          <button
            type="button"
            onClick={() => void salvar()}
            disabled={salvando}
            className="rounded-2xl bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-xs px-4 py-2.5 shadow-lg shadow-psi-vibrant/30 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {salvando ? 'Salvando…' : 'Salvar grade'}
          </button>
        </div>
      </div>

      {aviso && (
        <p
          className={`px-6 py-3 text-xs font-bold ${
            aviso.tipo === 'ok' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-rose-50 text-rose-800 border-b border-rose-200'
          }`}
        >
          {aviso.texto}
        </p>
      )}

      {/* Painel de Configuração em Lote (Modificar em Lote) */}
      {mostrarLote && (
        <div className="p-6 bg-psi-vibrant/5 border-b border-psi-vibrant/20 space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-psi-vibrant" />
              <h4 className="font-extrabold text-sm text-ink">Aplicar Horários para Múltiplos Dias</h4>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={selecionarDiasUteis}
                className="text-[11px] font-bold text-psi-vibrant hover:underline"
              >
                Dias Úteis (Seg-Sex)
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={selecionarTodosDias}
                className="text-[11px] font-bold text-psi-vibrant hover:underline"
              >
                Todos os Dias
              </button>
            </div>
          </div>

          {/* Seleção de Dias */}
          <div className="flex flex-wrap gap-2">
            {DIAS.map((dia, num) => {
              const selecionado = diasSelecionadosLote.includes(num);
              return (
                <button
                  key={dia}
                  type="button"
                  onClick={() => alternarDiaLote(num)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
                    selecionado
                      ? 'bg-psi-vibrant text-white border-psi-vibrant shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <CheckSquare className={`w-3.5 h-3.5 ${selecionado ? 'text-white' : 'text-slate-300'}`} />
                  {dia}
                </button>
              );
            })}
          </div>

          {/* Horários e Regras do Lote */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <label className="text-[11px] font-bold text-ink">
              Horário Início
              <input
                type="time"
                value={loteHoraInicio}
                onChange={(e) => setLoteHoraInicio(e.target.value)}
                className="input mt-1 py-2 text-xs w-full"
              />
            </label>

            <label className="text-[11px] font-bold text-ink">
              Horário Fim
              <input
                type="time"
                value={loteHoraFim}
                onChange={(e) => setLoteHoraFim(e.target.value)}
                className="input mt-1 py-2 text-xs w-full"
              />
            </label>

            <label className="text-[11px] font-bold text-ink">
              Duração Sessão
              <select
                value={loteDuracao}
                onChange={(e) => setLoteDuracao(Number(e.target.value))}
                className="input mt-1 py-2 text-xs w-full"
              >
                {[30, 45, 50, 60, 90].map((min) => (
                  <option key={min} value={min}>
                    {min} minutos
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[11px] font-bold text-ink">
              Modalidade
              <select
                value={loteModalidade}
                onChange={(e) => setLoteModalidade(e.target.value as 'online' | 'presencial')}
                className="input mt-1 py-2 text-xs w-full"
              >
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarLote(false)}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={aplicarLote}
              className="px-4 py-2 rounded-xl bg-psi-vibrant text-white text-xs font-extrabold hover:bg-psi-vibrant/90 shadow-md"
            >
              Aplicar para {diasSelecionadosLote.length} Dia(s)
            </button>
          </div>
        </div>
      )}

      {/* Lista de Janelas Cadastradas */}
      <div className="p-6 space-y-3">
        {rascunho.length === 0 && (
          <p className="text-xs text-muted py-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            Nenhuma janela de atendimento cadastrada. Utilize a opção acima para adicionar horários ou configurar em lote.
          </p>
        )}

        {rascunho.map((janela, indice) => (
          <div
            key={indice}
            className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-canvas/60 p-4 transition-all hover:border-psi-vibrant/40"
          >
            <label className="text-[11px] font-bold text-ink">
              Dia da Semana
              <select
                value={janela.diaSemana}
                onChange={(e) => alterar(indice, { diaSemana: Number(e.target.value) })}
                className="input mt-1 py-2 text-xs font-bold text-slate-800"
              >
                {DIAS.map((dia, numero) => (
                  <option key={dia} value={numero}>
                    {dia}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[11px] font-bold text-ink">
              Das
              <input
                type="time"
                value={janela.horaInicio}
                onChange={(e) => alterar(indice, { horaInicio: e.target.value })}
                className="input mt-1 py-2 text-xs font-bold text-slate-800"
              />
            </label>

            <label className="text-[11px] font-bold text-ink">
              Até
              <input
                type="time"
                value={janela.horaFim}
                onChange={(e) => alterar(indice, { horaFim: e.target.value })}
                className="input mt-1 py-2 text-xs font-bold text-slate-800"
              />
            </label>

            <label className="text-[11px] font-bold text-ink">
              Duração
              <select
                value={janela.duracaoMin}
                onChange={(e) => alterar(indice, { duracaoMin: Number(e.target.value) })}
                className="input mt-1 py-2 text-xs font-bold text-slate-800"
              >
                {[30, 45, 50, 60, 90].map((minutos) => (
                  <option key={minutos} value={minutos}>
                    {minutos} min
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[11px] font-bold text-ink">
              Modalidade
              <select
                value={janela.modalidade}
                onChange={(e) => alterar(indice, { modalidade: e.target.value as 'presencial' | 'online' })}
                className="input mt-1 py-2 text-xs font-bold text-slate-800"
              >
                <option value="online">Online</option>
                <option value="presencial">Presencial</option>
              </select>
            </label>

            <button
              type="button"
              onClick={() => setRascunho((atual) => atual.filter((_, i) => i !== indice))}
              aria-label="Remover janela"
              className="ml-auto rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-rose-600 hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setRascunho((atual) => [...atual, NOVA_JANELA])}
          className="btn-outline text-xs w-full justify-center py-3 border-dashed"
        >
          <Plus className="w-4 h-4 text-psi-vibrant" /> Adicionar janela individual
        </button>
      </div>
    </div>
  );
}

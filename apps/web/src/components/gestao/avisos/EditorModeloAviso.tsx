'use client';

import { useMemo, useRef, useState } from 'react';
import { History, RotateCcw, Save } from 'lucide-react';
import {
  ROTULO_CANAL,
  type AvisoDoCatalogo,
  type CanalAviso,
  type ConfiguracaoDoAviso,
} from '@/lib/avisos/catalogo';
import { renderizarModelo, validarModelo } from '@/lib/avisos/modelo';
import { dataHoraBr } from '@/components/gestao/gestaoApi';
import { PILULA_CAMPO, rotuloDoCampo, TextoComCampos } from './TextoComCampos';

export interface VersaoDoModelo {
  versao: number;
  texto: string | null;
  canal: CanalAviso;
  ativo: boolean;
  alteradoEm: string;
  alteradoPorNome?: string;
}

export interface ModeloDoEditor {
  finalidade: string;
  configuracao: ConfiguracaoDoAviso;
  atualizadoEm?: string;
  atualizadoPorNome?: string;
  versoes: VersaoDoModelo[];
  editavel: boolean;
}

interface Props {
  aviso: AvisoDoCatalogo;
  modelo: ModeloDoEditor;
  salvando: boolean;
  onSalvar: (entrada: { texto: string | null; canal: CanalAviso; ativo: boolean }) => Promise<void>;
}

/**
 * Edição de um aviso: texto com campos dinâmicos e prévia com valores de
 * exemplo, canal, ativação (complementares) e versões anteriores (12.02).
 */
export function EditorModeloAviso({ aviso, modelo, salvando, onSalvar }: Props) {
  const [texto, setTexto] = useState(modelo.configuracao.texto ?? aviso.modeloPadrao);
  const [canal, setCanal] = useState<CanalAviso>(modelo.configuracao.canal);
  const [ativo, setAtivo] = useState(modelo.configuracao.ativo);
  const [verHistorico, setVerHistorico] = useState(false);
  const area = useRef<HTMLTextAreaElement>(null);

  const exemplos = useMemo(
    () => Object.fromEntries(aviso.campos.map((campo) => [campo.nome, campo.exemplo])),
    [aviso.campos]
  );
  const problemas = validarModelo(texto, aviso.campos.map((c) => c.nome), aviso.camposObrigatorios);
  const ehPadrao = texto.trim() === aviso.modeloPadrao.trim();
  const mudou = (ehPadrao ? null : texto) !== modelo.configuracao.texto
    || canal !== modelo.configuracao.canal || ativo !== modelo.configuracao.ativo;

  function inserirCampo(nome: string) {
    const el = area.current;
    const marcador = `{{${nome}}}`;
    if (!el) return setTexto((atual) => atual + marcador);
    const inicio = el.selectionStart ?? texto.length;
    const fim = el.selectionEnd ?? texto.length;
    setTexto(texto.slice(0, inicio) + marcador + texto.slice(fim));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(inicio + marcador.length, inicio + marcador.length);
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="block text-[11px] font-bold text-muted">
          Texto da mensagem {ehPadrao && <span className="font-normal">(texto padrão)</span>}
          <TextoComCampos ref={area} value={texto} onChange={setTexto} rows={16} />
        </label>
        <div className="text-[11px] font-bold text-muted">
          Prévia com valores de exemplo
          <pre className="mt-1 max-h-[22rem] overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-psi-light px-3 py-2 font-sans text-[12px] font-normal leading-5 text-ink">
            {renderizarModelo(texto, exemplos)}
          </pre>
        </div>
      </div>

      <div>
        <p className="text-[11px] font-bold text-muted">Campos disponíveis — clique para inserir no cursor</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {aviso.campos.map((campo) => (
            <button
              key={campo.nome}
              type="button"
              title={campo.descricao}
              onClick={() => inserirCampo(campo.nome)}
              className={PILULA_CAMPO}
            >
              {rotuloDoCampo(campo.nome)}
              {aviso.camposObrigatorios.includes(campo.nome) && <span aria-label="obrigatório" className="text-rose-600">*</span>}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Uma linha que contém só um campo vazio é omitida. Campos com * são obrigatórios.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-[11px] font-bold text-muted">
          Canal
          <select
            value={canal}
            onChange={(event) => setCanal(event.target.value as CanalAviso)}
            className="mt-1 block rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink"
          >
            {aviso.canais.map((opcao) => <option key={opcao} value={opcao}>{ROTULO_CANAL[opcao]}</option>)}
          </select>
        </label>
        {!aviso.essencial && !aviso.ativacaoEm && (
          <label className="flex items-center gap-2 text-xs font-bold text-ink">
            <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
            Aviso ativo
          </label>
        )}
        {aviso.ativacaoEm && (
          <p className="text-[11px] text-muted">
            Ativação em <a className="font-bold text-psi-vibrant underline" href={aviso.ativacaoEm.href}>{aviso.ativacaoEm.rotulo}</a>.
          </p>
        )}
        {aviso.canais.length === 1 && (
          <p className="text-[11px] text-muted">Este aviso ainda só tem o canal {ROTULO_CANAL[aviso.canais[0]]}.</p>
        )}
        {aviso.canais.includes('email') && (
          <p className="text-[11px] text-muted">O texto editado vale para o WhatsApp; o e-mail mantém o layout próprio.</p>
        )}
      </div>

      {problemas.length > 0 && (
        <ul className="space-y-1 text-xs font-semibold text-rose-700">
          {problemas.map((problema) => <li key={problema.mensagem}>{problema.mensagem}</li>)}
        </ul>
      )}
      {!modelo.editavel && (
        <p className="text-xs font-semibold text-amber-800">A edição ainda não está disponível neste ambiente.</p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={salvando || !mudou || problemas.length > 0 || !modelo.editavel}
          onClick={() => void onSalvar({ texto: ehPadrao ? null : texto, canal, ativo })}
          className="btn-primary min-h-10 justify-center disabled:opacity-50"
        >
          <Save className="h-4 w-4" /> Salvar como versão {modelo.configuracao.versao + 1}
        </button>
        <button type="button" onClick={() => setTexto(aviso.modeloPadrao)} className="btn-ghost min-h-10 justify-center">
          <RotateCcw className="h-4 w-4" /> Voltar ao texto padrão
        </button>
        <button type="button" onClick={() => setVerHistorico((v) => !v)} className="btn-ghost min-h-10 justify-center">
          <History className="h-4 w-4" /> Versões ({modelo.versoes.length})
        </button>
      </div>

      {verHistorico && (
        <ol className="divide-y divide-line rounded-2xl border border-line bg-surface text-xs">
          {modelo.versoes.length === 0 && <li className="px-3 py-2 text-muted">Nenhuma versão gravada: vale o texto padrão.</li>}
          {modelo.versoes.map((versao) => (
            <li key={`${versao.versao}-${versao.alteradoEm}`} className="space-y-1 px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">
                  Versão {versao.versao} · {ROTULO_CANAL[versao.canal]}{!aviso.essencial ? ` · ${versao.ativo ? 'ativo' : 'desligado'}` : ''}
                </span>
                <span className="text-muted">{dataHoraBr(versao.alteradoEm)}{versao.alteradoPorNome ? ` · ${versao.alteradoPorNome}` : ''}</span>
              </div>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] text-muted">{versao.texto ?? '(texto padrão)'}</pre>
              <button type="button" onClick={() => setTexto(versao.texto ?? aviso.modeloPadrao)} className="text-[11px] font-bold text-psi-vibrant underline">
                Carregar este texto no editor
              </button>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

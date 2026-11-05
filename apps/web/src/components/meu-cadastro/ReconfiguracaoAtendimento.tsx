'use client';

import { useState } from 'react';
import { opcoesAtendimentoDaPos } from '@/components/forms/opcoesPsicologo';

interface Props {
  posGraduacao?: string;
  segundaPosGraduacao?: string;
  onConcluido: () => Promise<void>;
}

export function ReconfiguracaoAtendimento({ posGraduacao, segundaPosGraduacao, onConcluido }: Props) {
  const [publicos, setPublicos] = useState<string[]>([]);
  const [servicos, setServicos] = useState<string[]>([]);
  const [publicoOutro, setPublicoOutro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const opcoes = opcoesAtendimentoDaPos(posGraduacao, segundaPosGraduacao);
  const alternar = (lista: string[], valor: string) => lista.includes(valor)
    ? lista.filter((item) => item !== valor) : [...lista, valor];

  const salvar = async (evento: React.FormEvent) => {
    evento.preventDefault();
    if (!publicos.length || !servicos.length) {
      setErro('Selecione ao menos um público e um serviço da sua nova pós-graduação.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const response = await fetch('/api/application/credenciamento-psicologo/me', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicoAlvo: publicos, servicosPrestados: servicos,
          publicoAlvoOutro: publicos.includes('Outro') ? publicoOutro.trim() : '' }),
      });
      const body = await response.json() as { success: boolean; error?: string };
      if (!response.ok || !body.success) throw new Error(body.error ?? 'Não foi possível salvar as novas opções.');
      await onConcluido();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Não foi possível salvar as novas opções.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <form onSubmit={salvar} className="rounded-3xl border border-amber-200 bg-amber-50 p-6 space-y-5">
      <div>
        <h2 className="text-lg font-black text-amber-950">Sua pós-graduação foi alterada</h2>
        <p className="text-sm text-amber-900 mt-2">
          Selecione novamente o público que atende e os serviços clínicos de acordo com a formação aprovada pela gestão.
          Seu perfil fica fora da vitrine e de novos encaminhamentos até concluir esta etapa.
        </p>
        <p className="text-sm font-bold text-amber-950 mt-2">{posGraduacao}{segundaPosGraduacao ? ` · ${segundaPosGraduacao}` : ''}</p>
      </div>
      {opcoes ? (
        <>
          <fieldset disabled={salvando}>
            <legend className="text-sm font-extrabold text-ink mb-2">Público que atendo</legend>
            <div className="flex flex-wrap gap-3">
              {opcoes.publico.map((publico) => (
                <label key={publico} className="inline-flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={publicos.includes(publico)} onChange={() => setPublicos(alternar(publicos, publico))} />
                  {publico}
                </label>
              ))}
            </div>
            {publicos.includes('Outro') && (
              <label className="block text-sm text-ink mt-3">
                Qual outro público?
                <input value={publicoOutro} onChange={(e) => setPublicoOutro(e.target.value)} className="block mt-1 w-full rounded-xl border border-line p-3" />
              </label>
            )}
          </fieldset>
          <fieldset disabled={salvando}>
            <legend className="text-sm font-extrabold text-ink mb-2">Serviços clínicos que presto</legend>
            <div className="flex flex-wrap gap-3">
              {opcoes.servicos.map((servico) => (
                <label key={servico} className="inline-flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={servicos.includes(servico)} onChange={() => setServicos(alternar(servicos, servico))} />
                  {servico}
                </label>
              ))}
            </div>
          </fieldset>
          <button disabled={salvando} className="rounded-xl bg-psi-deep px-5 py-3 text-sm font-extrabold text-white disabled:opacity-50">
            {salvando ? 'Salvando...' : 'Confirmar novos públicos e serviços'}
          </button>
        </>
      ) : <p className="text-sm text-amber-900">Solicite à gestão a definição de uma pós-graduação válida para continuar.</p>}
      {erro && <p role="alert" className="text-sm font-bold text-red-800">{erro}</p>}
    </form>
  );
}

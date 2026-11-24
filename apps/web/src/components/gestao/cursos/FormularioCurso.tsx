'use client';

import { useState } from 'react';
import { PUBLICO_ALVO, SERVICOS_PRESTADOS, type CursoPos } from '@/components/forms/opcoesPsicologo';
import { chamarGestao } from '@/components/gestao/gestaoApi';

const FORMATOS: ReadonlyArray<['ONLINE' | 'PRESENCIAL', string]> = [['ONLINE', 'On-line'], ['PRESENCIAL', 'Presencial']];

function alternar<T>(lista: readonly T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((valor) => valor !== item) : [...lista, item];
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-1.5">
      <legend className="text-[11px] font-black uppercase tracking-wider text-muted">{titulo}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Marca({ marcado, onChange, rotulo }: { marcado: boolean; onChange: () => void; rotulo: string }) {
  return (
    <label className={`flex min-h-9 cursor-pointer items-center gap-1.5 rounded-xl border px-2.5 text-xs font-bold ${marcado ? 'border-psi-vibrant bg-psi-soft/40 text-psi-deep' : 'border-line text-ink'}`}>
      <input type="checkbox" checked={marcado} onChange={onChange} />
      {rotulo}
    </label>
  );
}

/**
 * Criação e edição de um curso (especificação final, 1.01 e 2.01). O nome não
 * muda depois de criado: é ele que liga o curso aos cadastros.
 */
export function FormularioCurso({ curso, onSalvo, onCancelar }: {
  /** Ausente: criação de curso novo. */
  curso?: CursoPos;
  onSalvo: () => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(curso?.nome ?? '');
  const [servicos, setServicos] = useState<string[]>([...(curso?.servicos ?? ['Atendimento Psicológico'])]);
  const [publicos, setPublicos] = useState<string[]>([...(curso?.publicos ?? PUBLICO_ALVO)]);
  const [tempos, setTempos] = useState<number[]>([...(curso?.tempos ?? [50, 90])]);
  const [variavel, setVariavel] = useState(Boolean(curso?.duracaoVariavel));
  const [formatos, setFormatos] = useState<('ONLINE' | 'PRESENCIAL')[]>([...(curso?.formatos ?? [])]);
  const [ativo, setAtivo] = useState(curso?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string>();

  const salvar = async () => {
    setSalvando(true);
    setErro(undefined);
    try {
      await chamarGestao('/api/application/gestao/cursos', {
        ...(curso ? { nomeOriginal: curso.nome } : { nome }),
        servicos, publicos, tempos, duracaoVariavel: variavel, formatos, ativo,
      }, 'PUT');
      await onSalvo();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : 'Falha ao salvar o curso.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="space-y-3 rounded-2xl border border-psi-soft bg-psi-soft/20 p-4">
      {curso ? (
        <p className="text-sm font-extrabold text-ink">{curso.nome}</p>
      ) : (
        <label className="block text-[11px] font-bold text-muted">Nome da pós-graduação
          <input value={nome} onChange={(event) => setNome(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-psi-vibrant focus:outline-none" />
        </label>
      )}
      <Grupo titulo="Modalidades de atendimento">
        {SERVICOS_PRESTADOS.map((servico) => (
          <Marca key={servico} rotulo={servico} marcado={servicos.includes(servico)} onChange={() => setServicos((atual) => alternar(atual, servico))} />
        ))}
      </Grupo>
      <Grupo titulo="Públicos">
        {PUBLICO_ALVO.map((publico) => (
          <Marca key={publico} rotulo={publico} marcado={publicos.includes(publico)} onChange={() => setPublicos((atual) => alternar(atual, publico))} />
        ))}
      </Grupo>
      <Grupo titulo="Durações">
        <Marca rotulo="50 minutos" marcado={!variavel && tempos.includes(50)} onChange={() => setTempos((atual) => alternar(atual, 50))} />
        <Marca rotulo="1h30" marcado={!variavel && tempos.includes(90)} onChange={() => setTempos((atual) => alternar(atual, 90))} />
        <Marca rotulo="Variável (informada no agendamento)" marcado={variavel} onChange={() => setVariavel((atual) => !atual)} />
      </Grupo>
      <Grupo titulo="Formatos permitidos (nenhum marcado = os dois)">
        {FORMATOS.map(([valor, rotulo]) => (
          <Marca key={valor} rotulo={rotulo} marcado={formatos.includes(valor)} onChange={() => setFormatos((atual) => alternar(atual, valor))} />
        ))}
      </Grupo>
      <label className="flex items-center gap-2 text-xs font-semibold text-ink">
        <input type="checkbox" checked={ativo} onChange={(event) => setAtivo(event.target.checked)} />
        Oferecido em cadastro novo (desmarcado, quem já está vinculado mantém as permissões)
      </label>
      {curso && (
        <p className="text-[11px] text-muted">
          Tirar uma modalidade ou público vale na hora para quem é desse curso. Uma modalidade nova ainda precisa ser escolhida pelo psicólogo e homologada.
        </p>
      )}
      {erro && <p className="text-xs font-semibold text-rose-700">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={salvando} onClick={() => void salvar()} className="btn-primary min-h-10 justify-center disabled:opacity-50">
          {salvando ? 'Salvando…' : curso ? 'Salvar curso' : 'Criar curso'}
        </button>
        <button type="button" onClick={onCancelar} className="btn-ghost min-h-10 justify-center">Cancelar</button>
      </div>
    </div>
  );
}

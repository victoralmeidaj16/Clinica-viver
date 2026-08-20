'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Search } from 'lucide-react';
import { normalizarCodigoVerificacao } from '@thats-life/core';

/**
 * Entrada da conferência, para quem digitou só `/validar`.
 *
 * O QR leva direto ao resultado; esta tela é para quem tem o papel e prefere
 * digitar o código. A normalização acontece antes de navegar — assim o erro de
 * digitação vira aviso aqui, e não uma consulta que consome o limite por
 * origem lá na frente.
 */
export default function ConferirDeclaracaoPage() {
  const router = useRouter();
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState<string>();

  function conferir(evento: React.FormEvent) {
    evento.preventDefault();
    const normalizado = normalizarCodigoVerificacao(codigo);
    if (!normalizado) {
      setErro('O código tem o formato VM-XXXX-XXXX. Confira o que está impresso no documento.');
      return;
    }
    router.push(`/validar/${normalizado}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-card space-y-5">
        <div className="flex items-start gap-3">
          <span className="p-2 rounded-xl bg-psi-soft text-psi-deep shrink-0">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <h2 className="font-black text-base text-ink leading-tight">Conferir uma declaração</h2>
            <p className="text-sm text-muted mt-1 leading-relaxed">
              Digite o código de conferência impresso no rodapé da declaração de horas de atendimento.
            </p>
          </div>
        </div>

        <form onSubmit={conferir} className="space-y-3">
          <label htmlFor="codigo" className="block text-[11px] font-bold uppercase tracking-wider text-muted">
            Código de conferência
          </label>
          <input
            id="codigo"
            value={codigo}
            onChange={(evento) => {
              setCodigo(evento.target.value);
              setErro(undefined);
            }}
            placeholder="VM-XXXX-XXXX"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            className="w-full px-4 py-3 border border-line rounded-2xl font-mono text-lg tracking-widest text-center uppercase focus:outline-none focus:ring-2 focus:ring-psi-vibrant"
          />
          {erro && <p className="text-xs font-semibold text-red-700">{erro}</p>}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-psi-vibrant hover:bg-psi-vibrant/90 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-psi-vibrant/30 transition-all"
          >
            <Search className="w-4 h-4" />
            Conferir
          </button>
        </form>
      </div>

      <p className="text-[11px] text-muted text-center leading-relaxed px-4">
        A conferência informa apenas o que a própria declaração já afirma: profissional, curso, período e carga
        horária. Nenhum dado de paciente é exibido.
      </p>
    </div>
  );
}

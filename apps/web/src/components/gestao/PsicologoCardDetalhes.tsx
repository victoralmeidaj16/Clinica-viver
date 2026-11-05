import React from 'react';
import { Phone } from 'lucide-react';
import { formatBrazilPhone } from '@/lib/brazilPhone';
import { formatGender } from '@/lib/gender';
import { rotuloModalidade, rotuloTipoAtendimento } from '@/components/forms/opcoesPsicologo';
import type { PsicologoItem } from './types';
import { SemaforoCredenciamento } from './SemaforoCredenciamento';
import { AceiteTermoAdesaoInfo } from './AceiteTermoAdesaoInfo';

interface Props { p: PsicologoItem; trabalhando: boolean; onReenviarConvite: (p: PsicologoItem) => void; }

export function PsicologoCardDetalhes({ p, trabalhando, onReenviarConvite }: Props) {
  const pausado = Boolean(p.pausadoNoRodizio);
  const semTurno = !p.turnosDisponiveis?.length;
  return (
        <div className="pt-4 border-t border-slate-200/80 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
          {pausado && (
            <p className="text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
              Sem novos encaminhamentos e fora da vitrine: {p.motivoPausaRodizio ?? 'sem motivo registrado'}
            </p>
          )}

          {semTurno && p.status === 'APROVADO' && !pausado && (
            <p className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              Sem turno cadastrado — não recebe encaminhamento, mesmo estando no rodízio.
            </p>
          )}

          {p.status !== 'RECUSADO' && (
            <SemaforoCredenciamento
              psicologo={p}
              reenviando={trabalhando}
              onReenviar={p.status === 'APROVADO' ? onReenviarConvite : undefined}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-100">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">CRP:</span>
                <span className="font-semibold text-slate-800">{p.crp || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Localidade:</span>
                <span className="font-semibold text-slate-800">
                  {p.cidade && p.estadoUf ? `${p.cidade}/${p.estadoUf}` : '—'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">Endereço:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {[p.logradouro, p.bairro].filter(Boolean).join(' — ') || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Gênero:</span>
                <span className="font-semibold text-slate-800">
                  {formatGender(p.genero, p.generoOutro) || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Atendimento:</span>
                <span className="font-extrabold text-purple-900">
                  {rotuloTipoAtendimento(p.atendimentoPreferencia)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">Modalidade:</span>
                <span className="font-semibold text-slate-800">
                  {rotuloModalidade(p.modalidadeAtendimento)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">Especialidade:</span>
                <span className="font-semibold text-slate-800 text-right">{p.especialidade || '—'}</span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">Pós-Graduação:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.posGraduacaoViverMais || '—'}
                  {p.segundaPosGraduacao ? ` · ${p.segundaPosGraduacao}` : ''}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">Último lead:</span>
                <span className="font-semibold text-slate-800 text-right">
                  {p.ultimoLeadRecebidoEm
                    ? new Date(p.ultimoLeadRecebidoEm).toLocaleDateString('pt-BR')
                    : 'Nunca — primeiro da fila'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-slate-500 shrink-0">E-mail:</span>
                <span className="font-semibold text-slate-800 text-right break-all">{p.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-500">WhatsApp:</span>
                <a
                  href={`https://wa.me/${p.whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-purple-600 font-bold hover:underline flex items-center gap-1"
                >
                  <Phone className="w-3 h-3" />
                  {formatBrazilPhone(p.whatsapp) || p.whatsapp}
                </a>
              </div>
            </div>
          </div>

          {p.acessibilidade && <div className="rounded-2xl border border-purple-100 bg-purple-50/50 p-4 text-xs">
            <p className="font-bold text-slate-700">Necessidade de acessibilidade do profissional: {p.acessibilidade.necessita ? 'Sim' : 'Não'}</p>
            {p.acessibilidade.necessita && p.acessibilidade.descricao && <p className="mt-1 whitespace-pre-wrap text-slate-600">{p.acessibilidade.descricao}</p>}
          </div>}
          <AceiteTermoAdesaoInfo psicologo={p} />

          {/* Tags de Serviços, Públicos e Necessidades */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {Boolean(p.servicosPrestados?.length) && (
              <div className="space-y-1 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 block">Serviços Prestados:</span>
                <div className="flex flex-wrap gap-1">
                  {p.servicosPrestados?.map((s) => (
                    <span
                      key={s}
                      className="text-[10px] font-bold bg-white text-slate-700 px-2 py-0.5 rounded-md border border-slate-200"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Boolean(p.publicoAlvo?.length || p.publicoAlvoOutro) && (
              <div className="space-y-1 bg-purple-50/50 p-3 rounded-2xl border border-purple-100">
                <span className="text-[11px] font-bold text-slate-500 block">Público Alvo:</span>
                <div className="flex flex-wrap gap-1">
                  {[...(p.publicoAlvo ?? []), ...(p.publicoAlvoOutro ? [p.publicoAlvoOutro] : [])].map((pa) => (
                    <span
                      key={pa}
                      className="text-[10px] font-bold bg-purple-50 text-purple-800 px-2 py-0.5 rounded-md border border-purple-100"
                    >
                      {pa}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {Boolean(p.necessidadesAtendidas?.length || p.necessidadesOutro) && (
              <div className="space-y-1 bg-teal-50/50 p-3 rounded-2xl border border-teal-100">
                <span className="text-[11px] font-bold text-slate-500 block">Demandas Atendidas:</span>
                <div className="flex flex-wrap gap-1">
                  {[...(p.necessidadesAtendidas ?? []), ...(p.necessidadesOutro ? [p.necessidadesOutro] : [])].map(
                    (n) => (
                      <span
                        key={n}
                        className="text-[10px] font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-md border border-teal-100"
                      >
                        {n}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}
          </div>

          {p.minibio && (
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 block">Apresentação:</span>
              <p className="text-[11px] text-slate-600 leading-5 bg-slate-50 border border-slate-100 rounded-2xl px-3 py-2">
                {p.minibio}
              </p>
            </div>
          )}
        </div>
  );
}

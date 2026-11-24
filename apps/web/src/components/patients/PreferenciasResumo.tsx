'use client';

import { History } from 'lucide-react';
import {
  CAMPOS_PREFERENCIA,
  diferencasPreferencias,
  formatarValorPreferencia,
  ROTULO_CAMPO_PREFERENCIA,
  type AlteracaoPreferencias,
  type CampoPreferencia,
  type PreferenciasSolicitacao,
  type ValorPreferencia,
} from '@/lib/preferenciasSolicitacao';

const ORIGEM: Record<PreferenciasSolicitacao['origem'], string> = {
  SITE: 'enviadas pelo site',
  CADASTRO_MANUAL: 'do cadastro manual',
  RECONSTRUIDA: 'registradas antes da primeira alteração',
};

function dataBr(iso: string): string {
  const instante = Date.parse(iso);
  return Number.isFinite(instante) ? new Date(instante).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : iso;
}

/**
 * Preferências do pedido com a origem preservada (especificação final, 4.04):
 * o que chegou, o que vale agora quando for diferente, e cada alteração.
 */
export function PreferenciasResumo({ originais, atuais, alteracoes }: {
  originais?: PreferenciasSolicitacao;
  atuais: Partial<Record<CampoPreferencia, ValorPreferencia>>;
  alteracoes?: readonly AlteracaoPreferencias[];
}) {
  const base = originais ?? atuais;
  const campos = CAMPOS_PREFERENCIA.filter((campo) =>
    campo !== 'servicoKey' && campo !== 'especificarNecessidades'
    && (base[campo] !== undefined || atuais[campo] !== undefined));
  const mudados = new Set(originais ? diferencasPreferencias(originais, atuais).map((item) => item.campo) : []);

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-muted">
        {originais
          ? `Preferências ${ORIGEM[originais.origem]} em ${dataBr(originais.registradoEm)}.`
          : 'Pedido anterior ao registro de origem: os valores abaixo nunca foram alterados.'}
      </p>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {campos.map((campo) => (
          <div key={campo} className="rounded-xl border border-psi-soft/60 bg-white p-2.5">
            <dt className="text-[10px] font-black uppercase tracking-wider text-muted">{ROTULO_CAMPO_PREFERENCIA[campo]}</dt>
            <dd className="mt-0.5 text-xs font-bold text-ink">{formatarValorPreferencia(campo, base[campo])}</dd>
            {mudados.has(campo) && (
              <dd className="mt-0.5 text-[11px] font-semibold text-amber-800">Atual: {formatarValorPreferencia(campo, atuais[campo])}</dd>
            )}
          </div>
        ))}
      </dl>
      {Boolean(alteracoes?.length) && (
        <ul className="space-y-1.5 border-t border-psi-soft/60 pt-2 text-[11px] text-muted">
          {[...alteracoes!].reverse().map((alteracao) => (
            <li key={alteracao.em}>
              <span className="flex items-center gap-1 font-bold text-ink">
                <History className="h-3 w-3" /> {dataBr(alteracao.em)}{alteracao.porNome ? ` · ${alteracao.porNome}` : ''}
              </span>
              {alteracao.campos.map((item) => (
                <span key={item.campo} className="block">
                  {ROTULO_CAMPO_PREFERENCIA[item.campo]}: {formatarValorPreferencia(item.campo, item.antes)} → {formatarValorPreferencia(item.campo, item.depois)}
                </span>
              ))}
              {alteracao.motivo && <span className="block italic">Motivo: {alteracao.motivo}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

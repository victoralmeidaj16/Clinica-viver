'use client';

import { ArrowRightLeft, History } from 'lucide-react';
import type { ManagedPatient } from './managementTypes';

const STATUS_TRIAGEM_LABEL: Record<string, string> = {
  PENDENTE_ATRIBUICAO: 'Aguardando gestão',
  AGUARDANDO_CONTATO: 'Aguardando contato',
  CONTATO_CONFIRMADO: 'Confirmado',
  DESISTENTE: 'Desistente',
  FINALIZADO: 'Alta',
  INATIVO: 'Inativo',
};

function dataBr(iso?: string): string {
  if (!iso) return '—';
  const timestamp = Date.parse(iso);
  return Number.isFinite(timestamp)
    ? new Date(timestamp).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
    : '—';
}

/**
 * Exibe histórico administrativo de solicitações repetidas para o mesmo CPF (§§ 4.02 e 6.09)
 * e motivos opcionais registrados nas recusas de encaminhamento (§ 5.04).
 */
export default function PatientAdministrativeHistoryPanel({ patient }: { patient: ManagedPatient }) {
  const historico = patient.historicoCpf ?? [];
  const recusas = patient.recusas ?? [];
  const temHistoricoCpf = historico.length > 1;
  if (!temHistoricoCpf && recusas.length === 0) return null;

  return (
    <div className="divide-y divide-psi-soft">
      {temHistoricoCpf && (
        <section className="py-6">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-psi-vibrant" />
              <h3 className="text-base font-black text-psi-darkest">Histórico administrativo deste CPF</h3>
            </div>
            <span className="rounded-full bg-psi-soft px-2.5 py-0.5 text-[11px] font-black text-psi-deep">
              {historico.length} solicitações
            </span>
          </div>
          <ul className="space-y-2 text-xs">
            {historico.map((entry) => (
              <li
                key={entry.leadId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-psi-soft/60 bg-psi-soft/15 px-3 py-2"
              >
                <div>
                  <p className="font-bold text-ink">
                    {entry.protocolo} · {dataBr(entry.criadoEm)}
                    {entry.atual && (
                      <span className="ml-2 rounded bg-psi-vibrant/15 px-1.5 py-0.5 text-[10px] font-black text-psi-vibrant">
                        Atual
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-muted">
                    {[entry.servico, entry.modalidade, entry.psicologoNome].filter(Boolean).join(' · ') || 'Sem detalhes'}
                  </p>
                </div>
                <span className="rounded-lg border border-psi-soft bg-white px-2 py-0.5 text-[11px] font-semibold text-ink">
                  {STATUS_TRIAGEM_LABEL[entry.status] ?? entry.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recusas.length > 0 && (
        <section className="py-6">
          <div className="mb-3 flex items-center gap-2">
            <ArrowRightLeft aria-hidden className="h-4 w-4 text-psi-vibrant" />
            <h3 className="text-base font-black text-psi-darkest">Recusas registradas no encaminhamento</h3>
          </div>
          <ul className="space-y-2 text-xs">
            {recusas.map((recusa, index) => (
              <li
                key={`${recusa.psicologoId}-${recusa.recusadoEm}-${index}`}
                className="rounded-xl border border-psi-soft bg-psi-light px-3 py-2"
              >
                <p className="font-bold text-ink">
                  {recusa.psicologoNome ?? recusa.psicologoId} · {dataBr(recusa.recusadoEm)}
                </p>
                <p className="mt-0.5 text-[11px] text-muted">
                  {recusa.motivo || 'Sem motivo informado'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

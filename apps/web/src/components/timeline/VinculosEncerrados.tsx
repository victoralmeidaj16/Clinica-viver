'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { applicationRequest } from '@/lib/applicationApi';
import type { PacienteDeVinculoEncerrado } from './usePacientesDaLinhaDoTempo';

/**
 * Prontuários de vínculos encerrados (especificação final, § 8.05).
 *
 * O paciente transferido sai de "Meus Pacientes", mas a autora continua com
 * acesso aos registros que fez. Este bloco é a entrada para eles, mesmo para
 * quem não tem mais nenhum paciente atual.
 */
export function VinculosEncerradosLista({ pacientes }: { pacientes: readonly PacienteDeVinculoEncerrado[] }) {
  if (pacientes.length === 0) return null;
  return (
    <section className="card space-y-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <FileText className="h-4 w-4 text-psi-vibrant" /> Prontuários de vínculos encerrados
        </h3>
        <p className="mt-1 text-xs text-muted">
          Pacientes que você não atende mais. Você consulta os registros que fez e pode acrescentar complementos.
        </p>
      </div>
      <ul className="flex flex-wrap gap-2">
        {pacientes.map((paciente) => (
          <li key={paciente.patientId}>
            <Link
              href={`/linha-do-tempo?patientId=${encodeURIComponent(paciente.patientId)}`}
              className="inline-flex min-h-11 items-center rounded-xl border border-line bg-canvas px-3 text-xs font-bold text-ink hover:border-psi-vibrant/40 hover:text-psi-vibrant"
            >
              {paciente.displayName}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Busca a lista; sem acesso clínico ou em caso de falha, simplesmente não mostra o bloco. */
export function VinculosEncerrados() {
  const [pacientes, setPacientes] = useState<PacienteDeVinculoEncerrado[]>([]);

  useEffect(() => {
    let cancelled = false;
    applicationRequest<PacienteDeVinculoEncerrado[]>('/timeline/vinculos-encerrados')
      .then((items) => {
        if (!cancelled && Array.isArray(items)) setPacientes(items);
      })
      .catch(() => {
        // Bloco opcional: a lista de pacientes atuais continua funcionando.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <VinculosEncerradosLista pacientes={pacientes} />;
}

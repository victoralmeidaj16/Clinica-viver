import 'server-only';
import type { RowDataPacket } from 'mysql2';
import { getMysqlPool, isMysqlConfigured } from '@/server/oci/runtime';
import { getCaptureRepository } from '@/server/persistence/captureRepository';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export async function publicoDoVinculo(organizationId: string, patientId: string): Promise<string | undefined> {
  if (isMysqlConfigured()) {
    const [rows] = await getMysqlPool().execute<RowDataPacket[]>(
      `SELECT para_quem_e FROM clinica_triagens_pacientes
        WHERE instituicao_id = ? AND organizacao_ref = ? AND paciente_ref = ?
        ORDER BY atualizado_em DESC, id DESC LIMIT 1`,
      [instituicaoId(), organizationId, patientId],
    );
    return rows[0]?.para_quem_e ?? undefined;
  }

  const demoOrganizationId = process.env.ORGANIZATION_ID?.trim() || process.env.NEXT_PUBLIC_ORGANIZATION_ID?.trim() || 'org-demo';
  if (organizationId !== demoOrganizationId) return undefined;
  const { triagensPacientes } = await getCaptureRepository().read();
  return triagensPacientes.filter((triagem) => triagem.pacienteRef === patientId)
    .sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))[0]?.paraQuemE;
}

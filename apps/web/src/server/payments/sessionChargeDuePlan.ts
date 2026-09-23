import 'server-only';
import type { RowDataPacket } from 'mysql2';
import type { PoolConnection } from 'mysql2/promise';
import { instituicaoId } from '@/server/persistence/mysql/mappers';

export interface DueResetPlan {
  paid?: boolean;
  charges: RowDataPacket[];
  checkouts: RowDataPacket[];
  remotes: Array<{ provider: string; id: string }>;
}

export async function readDueResetPlan(connection: PoolConnection, appointmentId: string): Promise<DueResetPlan | null> {
  const [charges] = await connection.query<RowDataPacket[]>(
    `SELECT c.ref_core, c.status, c.provedor_ref, c.organizacao_ref,
            EXISTS(SELECT 1 FROM financeiro_pagamentos p
              WHERE p.instituicao_id = c.instituicao_id AND p.organizacao_ref = c.organizacao_ref
                AND p.cobranca_ref = c.ref_core AND p.status = 'confirmed') AS possui_pagamento
       FROM clinica_agendamentos a
       JOIN clinica_organizacoes o ON o.id = a.organizacao_id
       JOIN financeiro_cobrancas c ON c.instituicao_id = a.instituicao_id
        AND c.organizacao_ref = o.ref_core
        AND c.sessao_ref IN (a.ref_core, COALESCE(a.sessao_clinica_ref, a.ref_core))
      WHERE a.instituicao_id = ? AND (a.id = ? OR a.ref_core = ?) AND c.status <> 'cancelled'
      FOR UPDATE`,
    [instituicaoId(), appointmentId, appointmentId]
  );
  if (!charges.length) return null;
  if (charges.some((c) => Boolean(c.possui_pagamento) || ['paid', 'partially_paid', 'refunded'].includes(String(c.status)))) return { paid: true as const, charges, checkouts: [], remotes: [] };
  const refs = charges.map((c) => String(c.ref_core));
  const [checkouts] = await connection.query<RowDataPacket[]>(
    `SELECT x.id, x.cobranca_ref, x.referencia_externa, x.provedor, x.provedor_pagamento_ref, x.status
       FROM financeiro_checkouts_asaas x
      WHERE x.instituicao_id = ? AND x.organizacao_ref = ?
        AND (x.cobranca_ref IN (?) OR x.referencia_externa IN (
          SELECT m.referencia_externa FROM financeiro_checkout_cobrancas m
           WHERE m.instituicao_id = ? AND m.cobranca_ref IN (?)
        )) FOR UPDATE`,
    [instituicaoId(), charges[0].organizacao_ref, refs, instituicaoId(), refs]
  );
  if (checkouts.some((x) => ['paid', 'refunded'].includes(String(x.status)))) return { paid: true as const, charges, checkouts: [], remotes: [] };
  const remotes = new Map<string, { provider: string; id: string }>();
  for (const checkout of checkouts) {
    if (checkout.provedor && !checkout.provedor_pagamento_ref) {
      throw new Error('Pagamento em emissão. Aguarde a conclusão para alterar o vencimento.');
    }
    if (checkout.provedor_pagamento_ref) {
      const provider = String(checkout.provedor ?? 'asaas');
      const id = String(checkout.provedor_pagamento_ref);
      remotes.set(`${provider}:${id}`, { provider, id });
    }
  }
  for (const charge of charges) {
    if (!charge.provedor_ref) continue;
    const checkout = checkouts.find((x) => x.provedor_pagamento_ref === charge.provedor_ref);
    const provider = String(checkout?.provedor ?? 'asaas');
    const id = String(charge.provedor_ref);
    remotes.set(`${provider}:${id}`, { provider, id });
  }
  return { charges, checkouts, remotes: [...remotes.values()] };
}

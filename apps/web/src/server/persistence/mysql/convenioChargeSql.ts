/**
 * Mantém o histórico faturado/recebido, mas não oferece atendimentos cancelados
 * para cobrança. O agendamento também é verificado para cobrir cancelamentos
 * antigos ou uma falha na sincronização do financeiro.
 */
export function cobrancaVisivelNoConvenioSql(charge: 'fc' | 'fc_base'): string {
  return `(
    ${charge}.fatura_convenio_ref IS NOT NULL
    OR ${charge}.status IN ('paid', 'partially_paid', 'refunded')
    OR (
      ${charge}.status <> 'cancelled'
      AND NOT EXISTS (
        SELECT 1 FROM clinica_agendamentos cancelado
        JOIN clinica_organizacoes cancelado_org ON cancelado_org.id = cancelado.organizacao_id
        WHERE cancelado.instituicao_id = ${charge}.instituicao_id
          AND cancelado_org.ref_core = ${charge}.organizacao_ref
          AND ${charge}.sessao_ref IN (cancelado.ref_core, cancelado.sessao_clinica_ref)
          AND cancelado.status = 'cancelado'
      )
      AND NOT EXISTS (
        SELECT 1 FROM clinica_sessoes cancelada
        WHERE cancelada.instituicao_id = ${charge}.instituicao_id
          AND cancelada.organizacao_ref = ${charge}.organizacao_ref
          AND cancelada.ref_core = ${charge}.sessao_ref
          AND cancelada.status = 'cancelled'
      )
    )
  )`;
}

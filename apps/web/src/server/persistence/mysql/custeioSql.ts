import 'server-only';

/**
 * Expressão SQL do custeio efetivo de uma sessão.
 *
 * Vive num lugar só porque a regra é lida em sete consultas espalhadas — agenda,
 * link de pagamento, cobrança, financeiro do psicólogo, financeiro da clínica,
 * relatório de convênio — e a versão anterior era o mesmo `CASE` copiado em
 * todas. Enquanto o custeio era um booleano do paciente, a cópia sobrevivia;
 * com cota, cada consulta que ficasse para trás mostraria "empresa paga" numa
 * sessão que a clínica já cobrou do paciente.
 *
 * A ordem das condições é a regra do acordo:
 *   1. sem convênio, quem paga é o paciente;
 *   2. exceção gravada no paciente vence a política do convênio;
 *   3. sem cota, o custeio vale para todas as sessões (comportamento antigo);
 *   4. com cota, desconta decisões gravadas e agendamentos anteriores elegíveis.
 *
 * Na consulta de uma sessão, as anteriores reservam o saldo por ordem de início
 * e id. Cancelamentos e faltas sem decisão não reservam benefício. A reserva é
 * recalculada; apenas a decisão gravada na realização é definitiva.
 * Sem agendamento de referência, retorna o saldo efetivamente consumido.
 */
export function custeioEfetivoSql(alias: {
  /** Alias da tabela `clinica_pacientes`. */
  paciente: string;
  /** Alias da tabela `clinica_convenios` (LEFT JOIN). */
  convenio: string;
  /** Agendamento cuja posição na cota deve ser projetada. */
  agendamento?: string;
  /**
   * Expressão da data da sessão, para recortar o ciclo mensal. Sem uma sessão
   * em vista — a lista de pacientes do convênio, por exemplo — vale "hoje", que
   * responde a pergunta que a tela faz: a próxima sessão sai por conta de quem?
   */
  referencia?: string;
}): string {
  const p = alias.paciente;
  const c = alias.convenio;
  const referencia = alias.referencia ?? 'CURRENT_TIMESTAMP(3)';
  const a = alias.agendamento;
  const reservaAnterior = a ? `OR (cota_ag.custeado_pela_empresa IS NULL
               AND NOT EXISTS (SELECT 1 FROM financeiro_cobrancas cota_fc
                                WHERE cota_fc.instituicao_id = cota_ag.instituicao_id
                                  AND cota_fc.sessao_ref IN (cota_ag.ref_core, cota_ag.id)
                                  AND cota_fc.status <> 'cancelled')
               AND cota_ag.status IN ('agendado', 'confirmado', 'realizado')
               AND (cota_ag.inicio < ${a}.inicio
                    OR (cota_ag.inicio = ${a}.inicio AND cota_ag.id < ${a}.id)))` : '';
  return `CASE
    WHEN ${p}.convenio_ref IS NULL THEN 0
    WHEN COALESCE(${p}.custeado_pela_empresa, ${c}.empresa_paga_sessoes, 1) = 0 THEN 0
    WHEN ${p}.custeio_sessoes_cota IS NULL THEN 1
    WHEN (SELECT COUNT(*) FROM clinica_agendamentos cota_ag
           WHERE cota_ag.instituicao_id = ${p}.instituicao_id
             AND cota_ag.paciente_id = ${p}.id
             AND (cota_ag.custeado_pela_empresa = 1 ${reservaAnterior})
             AND (${p}.custeio_sessoes_ciclo <> 'mensal'
                  OR DATE_FORMAT(cota_ag.inicio, '%Y-%m') = DATE_FORMAT(${referencia}, '%Y-%m')))
         < ${p}.custeio_sessoes_cota THEN 1
    ELSE 0 END`;
}

/**
 * Custeio de um agendamento: a decisão gravada, quando já houve uma.
 *
 * Depois que a sessão é confirmada como realizada, quem paga está decidido e
 * não muda mais — nem se a gestão editar a cota depois. Sem isso, aumentar a
 * cota de quatro para seis mandaria a conta de sessões já pagas pelo paciente
 * para a empresa, e reduzi-la cobraria de novo quem já quitou.
 */
export function custeioDoAgendamentoSql(alias: {
  agendamento: string;
  paciente: string;
  convenio: string;
}): string {
  return `COALESCE(${alias.agendamento}.custeado_pela_empresa, ${custeioEfetivoSql({
    paciente: alias.paciente,
    convenio: alias.convenio,
    agendamento: alias.agendamento,
    referencia: `${alias.agendamento}.inicio`,
  })})`;
}

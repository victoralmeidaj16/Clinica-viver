// Ajuste pontual autorizado: sessão paga de 14/09 para 11/09/2026 às 10h BRT.
// Execute no container web com sua configuração MySQL. Não emite NFS-e.
const mysql = require('mysql2/promise');

async function main() {
  const c = await mysql.createConnection({ ...(process.env.DATABASE_URL ? { uri: process.env.DATABASE_URL } : {
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  }), timezone: 'Z' });
  const target = 'agenda-link-10875550-59c4-41da-8c97-fef6ee33196c';
  const start = '2026-09-11 13:00:00.000';
  const end = '2026-09-11 13:50:00.000';
  try {
    await c.query("SET time_zone = '+00:00'");
    await c.beginTransaction();
    const [rows] = await c.query(`SELECT a.*, p.nome AS profissional_nome,
      p.ref_core AS profissional_ref, pa.ref_core AS paciente_ref,
      o.ref_core AS organizacao_ref
      FROM clinica_agendamentos a
      JOIN clinica_profissionais p ON p.id = a.profissional_id
      JOIN clinica_pacientes pa ON pa.id = a.paciente_id
      JOIN clinica_organizacoes o ON o.id = p.organizacao_id
      WHERE a.ref_core = ? FOR UPDATE`, [target]);
    if (rows.length !== 1) throw new Error('Sessão alvo não é única.');
    const a = rows[0];
    if (a.profissional_nome !== 'Giuliana Alano de Oliveira') throw new Error('Profissional inesperado.');
    const [charges] = await c.query(`SELECT ref_core, status, valor_centavos
      FROM financeiro_cobrancas WHERE instituicao_id = ? AND sessao_ref = ? FOR UPDATE`,
    [a.instituicao_id, target]);
    if (charges.length !== 1 || charges[0].status !== 'paid' || Number(charges[0].valor_centavos) !== 7500) {
      throw new Error('Cobrança paga esperada não encontrada.');
    }
    const current = new Date(a.inicio).toISOString();
    if (current === '2026-09-11T13:00:00.000Z' && a.status === 'realizado' && a.sessao_clinica_ref) {
      await c.rollback();
      console.log('Ajuste já aplicado.');
      return;
    }
    if (current !== '2026-09-14T20:00:00.000Z' || a.status !== 'agendado' || a.sessao_clinica_ref || a.duracao_min !== 50) {
      throw new Error('Estado original mudou; ajuste interrompido.');
    }
    const [invoices] = await c.query(`SELECT id FROM fiscal_nfse_emissoes
      WHERE instituicao_id = ? AND cobranca_ref = ?`, [a.instituicao_id, charges[0].ref_core]);
    if (invoices.length) throw new Error('Existe emissão fiscal vinculada; ajuste interrompido.');
    const sessionRef = `session-${target}`;
    const step = { status: 'skipped', attemptCount: 0, updatedAt: '2026-09-11T13:50:00.000Z' };
    const automation = Object.fromEntries(['transcription', 'clinicalDraft', 'patientHandoff', 'billing', 'receipt', 'notification'].map(k => [k, step]));
    await c.execute(`INSERT INTO clinica_sessoes
      (id, instituicao_id, organizacao_ref, ref_core, paciente_ref,
       profissional_principal_ref, profissionais_atribuidos, status, modalidade,
       inicio_previsto, fim_previsto, inicio_real, fim_real, consentimentos,
       automacao_plano, automacao_estado, cobranca_ref, versao, criado_em, atualizado_em)
      VALUES (UUID(), ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, '[]', ?, ?, ?, 1, NOW(3), NOW(3))`,
    [a.instituicao_id, a.organizacao_ref, sessionRef, a.paciente_ref, a.profissional_ref,
      JSON.stringify([a.profissional_ref]), a.modalidade === 'online' ? 'video' : a.modalidade === 'telefone' ? 'phone' : 'in_person',
      start, end, start, end,
      JSON.stringify({ transcription: false, patientHandoff: false, billing: false, receipt: false, notification: false }),
      JSON.stringify(automation), charges[0].ref_core]);
    const [result] = await c.execute(`UPDATE clinica_agendamentos
      SET inicio = ?, fim = ?, status = 'realizado', realizado_em = ?,
          sessao_clinica_ref = ?, versao = versao + 1, atualizado_em = NOW(3)
      WHERE id = ? AND instituicao_id = ?`, [start, end, end, sessionRef, a.id, a.instituicao_id]);
    if (result.affectedRows !== 1) throw new Error('Quantidade inesperada de sessões alteradas.');
    await c.execute(`UPDATE financeiro_cobrancas SET descricao = ?, atualizado_em = NOW(3)
      WHERE instituicao_id = ? AND ref_core = ?`,
    ['Atendimento Psicoterápico — sessão em 11/09/2026 às 10:00.', a.instituicao_id, charges[0].ref_core]);
    await c.commit();
    console.log(JSON.stringify({ appointmentsUpdated: 1, startBRT: '11/09/2026 10:00', endBRT: '11/09/2026 10:50', status: 'realizado', payment: 'paid', invoiceIssued: false }));
  } catch (error) {
    await c.rollback();
    throw error;
  } finally {
    await c.end();
  }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });

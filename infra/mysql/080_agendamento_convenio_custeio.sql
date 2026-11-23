-- Guarda a empresa da decisão de custeio, inclusive antes da primeira cobrança.
SET @ddl := IF(EXISTS(SELECT 1 FROM information_schema.columns
 WHERE table_schema = DATABASE() AND table_name = 'clinica_agendamentos' AND column_name = 'custeio_convenio_ref'),
 'SELECT 1', 'ALTER TABLE clinica_agendamentos ADD COLUMN custeio_convenio_ref VARCHAR(128) NULL');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- A empresa que pagou é evidência histórica mesmo depois de uma troca de vínculo.
-- Não atribuir ao convênio atual um atendimento antigo de pagador desconhecido.
UPDATE clinica_agendamentos a
JOIN (
  SELECT ag.id, MIN(COALESCE(f.convenio_ref, c.convenio_ref)) AS convenio_ref
    FROM clinica_agendamentos ag
    JOIN clinica_organizacoes o ON o.id = ag.organizacao_id
    JOIN financeiro_cobrancas c ON c.instituicao_id = ag.instituicao_id
     AND c.organizacao_ref = o.ref_core AND c.sessao_ref IN (ag.ref_core, ag.sessao_clinica_ref)
    LEFT JOIN financeiro_faturas_convenio f ON f.instituicao_id = c.instituicao_id
     AND f.organizacao_ref = c.organizacao_ref AND f.ref_core = c.fatura_convenio_ref
   WHERE ag.status = 'realizado' AND ag.custeado_pela_empresa = 1
     AND COALESCE(f.convenio_ref, c.convenio_ref) IS NOT NULL AND c.status <> 'cancelled'
   GROUP BY ag.id HAVING COUNT(DISTINCT COALESCE(f.convenio_ref, c.convenio_ref)) = 1
) historico ON historico.id = a.id
SET a.custeio_convenio_ref = historico.convenio_ref
WHERE a.custeio_convenio_ref IS NULL;

UPDATE clinica_agendamentos a
JOIN clinica_pacientes p ON p.id = a.paciente_id AND p.organizacao_id = a.organizacao_id
SET a.custeio_convenio_ref = p.convenio_ref,
    a.custeado_pela_empresa = IF(p.convenio_ref IS NULL, NULL, 1)
WHERE a.custeado_pela_empresa = 1 AND a.custeio_convenio_ref IS NULL
  AND a.status IN ('agendado', 'confirmado');

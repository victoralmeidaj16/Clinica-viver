-- Localização estruturada e capacidade máxima por psicólogo.
-- Idempotente para instalações que já receberam parte da alteração.

SET @estado_uf_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'estado_uf'
);
SET @sql_estado_uf := IF(
  @estado_uf_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN estado_uf CHAR(2) NULL AFTER cidade_uf',
  'SELECT 1'
);
PREPARE stmt_estado_uf FROM @sql_estado_uf;
EXECUTE stmt_estado_uf;
DEALLOCATE PREPARE stmt_estado_uf;

SET @cidade_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'cidade'
);
SET @sql_cidade := IF(
  @cidade_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN cidade VARCHAR(160) NULL AFTER estado_uf',
  'SELECT 1'
);
PREPARE stmt_cidade FROM @sql_cidade;
EXECUTE stmt_cidade;
DEALLOCATE PREPARE stmt_cidade;

UPDATE clinica_cadastros_psicologos
   SET estado_uf = UPPER(TRIM(SUBSTRING_INDEX(cidade_uf, '/', -1))),
       cidade = TRIM(SUBSTRING_INDEX(cidade_uf, '/', 1))
 WHERE cidade_uf LIKE '%/%'
   AND (estado_uf IS NULL OR cidade IS NULL);

-- Normaliza para o teto operacional apenas quem está fora da faixa válida.
-- Sem o WHERE, reaplicar este arquivo apagaria todo limite que a gestão tenha
-- ajustado por profissional — e o runner reaplica quando a linha em
-- schema_migrations não existe (banco novo restaurado, ambiente recriado).
UPDATE clinica_cadastros_psicologos
   SET limite_pacientes_ativos = 5
 WHERE limite_pacientes_ativos IS NULL
    OR limite_pacientes_ativos NOT BETWEEN 1 AND 5;

UPDATE clinica_cadastros_psicologos p
   SET pacientes_ativos_count = (
     SELECT COUNT(*)
       FROM clinica_triagens_pacientes t
      WHERE t.instituicao_id = p.instituicao_id
        AND t.organizacao_ref = p.organizacao_ref
        AND t.psicologo_alocado_id = p.ref_core
        AND t.status = 'CONTATO_CONFIRMADO'
   );

ALTER TABLE clinica_cadastros_psicologos
  MODIFY COLUMN limite_pacientes_ativos INT UNSIGNED NOT NULL DEFAULT 5;

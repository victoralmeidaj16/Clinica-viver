-- Associa certificados automáticos ao tenant, aluno e curso e impede duplicação.
-- Colunas nulas preservam certificados legados emitidos antes do portal acadêmico.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'instituicao_id'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN instituicao_id VARCHAR(64) NULL AFTER codigo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND index_name = 'clinica_certificados_aluno_curso_uq'),
  'SELECT 1',
  'CREATE UNIQUE INDEX clinica_certificados_aluno_curso_uq ON clinica_certificados (instituicao_id, aluno_id, curso_id)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

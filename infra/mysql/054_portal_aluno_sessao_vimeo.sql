-- Portal do aluno: revogação de sessões após troca/redefinição de senha e hash
-- de privacidade de vídeos Vimeo não listados (sem ele o embed recusa tocar).

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name AND table_name = 'clinica_alunos' AND column_name = 'senha_alterada_em'),
  'SELECT 1',
  'ALTER TABLE clinica_alunos ADD COLUMN senha_alterada_em TIMESTAMP(3) NULL AFTER senha_redefinida_por'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name AND table_name = 'clinica_cursos_aulas' AND column_name = 'vimeo_hash'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_aulas ADD COLUMN vimeo_hash VARCHAR(32) NULL AFTER vimeo_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Vínculos acadêmicos do psicólogo (especificação final, 2.02, 3.2, 3.10 e 1.04).
--
--   segunda_turma_viver_mais  turma da segunda pós-graduação, que até aqui não
--                             era registrada
--   vinculos_academicos       decisão da Gestão sobre cada vínculo (pós e
--                             turma): aprovado, pendente ou recusado, com data,
--                             autor, motivo e validade opcional
--
-- Sem decisão gravada, o vínculo segue a situação do cadastro (aprovado,
-- em análise ou recusado), que é a regra que valia até aqui — nenhum
-- psicólogo atual muda de permissão por causa desta migration.
--
-- Idempotente.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'segunda_turma_viver_mais'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN segunda_turma_viver_mais VARCHAR(16) NULL AFTER segunda_pos_graduacao_viver_mais'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_cadastros_psicologos'
            AND column_name = 'vinculos_academicos'),
  'SELECT 1',
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN vinculos_academicos JSON NULL'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

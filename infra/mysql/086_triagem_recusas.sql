-- Registro de recusas com motivo opcional no encaminhamento (§ 5.04).
--
-- Idempotente: aplicável a banco novo e a instalação já em produção.
-- Enquanto não aplicada, `MysqlCaptureRepository` omite a coluna sem falhar
-- o encaminhamento nem quebrar leituras anteriores.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'recusas'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN recusas JSON NULL AFTER psicologos_ja_tentados'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Nome social do paciente na triagem.
--
-- Permite que pacientes que utilizam nome social sejam acolhidos e identificados
-- pelo nome de sua preferência no fluxo de atendimento e nas comunicações por e-mail e WhatsApp.
--
-- Idempotente: aplicável a banco novo e a instalação já em produção.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'nome_social'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN nome_social VARCHAR(255) NULL AFTER nome_paciente'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

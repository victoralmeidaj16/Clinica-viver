-- Dados operacionais mínimos para reconstruir avisos que falharam, sem guardar
-- números de telefone ou texto de mensagens na fila.
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'clinica_agenda_avisos' AND column_name = 'dados_reenvio'),
  'SELECT 1', 'ALTER TABLE clinica_agenda_avisos ADD COLUMN dados_reenvio JSON NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

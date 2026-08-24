-- Entrega da NFS-e ao paciente.
--
-- O envio fica na mesma trilha da emissão para que uma nota fiscal confirmada
-- nunca volte a parecer "não emitida" só porque o provedor de e-mail falhou.
-- O estado `sending` também funciona como trava entre requisições concorrentes.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'email_destinatario'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN email_destinatario VARCHAR(320) NULL AFTER cancelamento_motivo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'email_status'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN email_status ENUM(''sending'',''sent'',''failed'') NULL AFTER email_destinatario'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'email_processando_em'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN email_processando_em TIMESTAMP(3) NULL AFTER email_status'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'email_enviado_em'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN email_enviado_em TIMESTAMP(3) NULL AFTER email_processando_em'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'email_provider_id'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN email_provider_id VARCHAR(128) NULL AFTER email_enviado_em'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'email_erro'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN email_erro VARCHAR(1000) NULL AFTER email_provider_id'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name
            AND table_name = 'fiscal_nfse_emissoes'
            AND column_name = 'email_tentativas'),
  'SELECT 1',
  'ALTER TABLE fiscal_nfse_emissoes ADD COLUMN email_tentativas SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER email_erro'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

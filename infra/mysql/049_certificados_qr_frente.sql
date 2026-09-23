-- Adiciona colunas para controle e posicionamento do QR code na frente do certificado.
--
-- `qr_frente_ativo`: 1 (ou NULL com coordenadas) = exibe o QR na frente; 0 = desativa.
-- `qr_frente_x`: posição horizontal em % da página (0 a 100).
-- `qr_frente_y`: posição vertical em % da página (0 a 100).
-- `qr_frente_tamanho`: largura/altura do QR em % da página (ex: 8.5).
--
-- Idempotente: seguro para execução repetida em ambientes de homologação e produção.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'qr_frente_ativo'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN qr_frente_ativo TINYINT(1) NULL DEFAULT 1 AFTER carimbo_qr'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'qr_frente_x'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN qr_frente_x DECIMAL(5,2) NULL AFTER qr_frente_ativo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'qr_frente_y'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN qr_frente_y DECIMAL(5,2) NULL AFTER qr_frente_x'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'qr_frente_tamanho'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN qr_frente_tamanho DECIMAL(4,1) NULL AFTER qr_frente_y'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

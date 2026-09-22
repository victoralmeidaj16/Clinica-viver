-- Carimbo do verso do certificado com forma, texto e QR livres.
--
-- O carimbo só tinha posição e fonte: a largura seguia a linha mais longa do
-- texto, então ele era sempre uma faixa retangular, e o texto era sempre o
-- gerado dos dados do certificado.
--
-- `carimbo_largura` fixa a largura em % da página (o texto quebra dentro dela,
-- o que permite um bloco quadrado); `carimbo_texto` guarda o texto editado à
-- mão; `carimbo_qr` põe o QR de conferência ao lado ('left') ou acima ('top')
-- do texto. `NULL` nas três mantém o carimbo dos certificados já emitidos
-- exatamente como era.
--
-- Idempotente: aplicável a banco novo e a instalação já em produção.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'carimbo_largura'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN carimbo_largura DECIMAL(5,2) NULL AFTER carimbo_align'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'carimbo_texto'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN carimbo_texto TEXT NULL AFTER carimbo_largura'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_certificados'
            AND column_name = 'carimbo_qr'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN carimbo_qr VARCHAR(8) NULL AFTER carimbo_texto'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

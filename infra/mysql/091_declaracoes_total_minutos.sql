-- Armazena o total de minutos reais das sessões na declaração de estágio (§ 8.03).
--
-- Idempotente: enquanto não aplicada, `DeclaracaoHorasRepository` grava e lê
-- apenas `total_horas` (convertendo em múltiplos de 60 minutos na leitura).

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_declaracoes_horas'
            AND column_name = 'total_minutos'),
  'SELECT 1',
  'ALTER TABLE clinica_declaracoes_horas ADD COLUMN total_minutos INT UNSIGNED NULL AFTER total_horas'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

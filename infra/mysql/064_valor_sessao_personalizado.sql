-- Categoria e valor individual da sessão, configuráveis pela Gestão no
-- cadastro do paciente. NULL preserva a regra legada da modalidade da triagem.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_pacientes'
            AND column_name = 'categoria_valor_sessao'),
  'SELECT 1',
  'ALTER TABLE clinica_pacientes ADD COLUMN categoria_valor_sessao VARCHAR(16) NULL AFTER custeio_sessoes_ciclo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_pacientes'
            AND column_name = 'valor_sessao_personalizado_centavos'),
  'SELECT 1',
  'ALTER TABLE clinica_pacientes ADD COLUMN valor_sessao_personalizado_centavos BIGINT NULL AFTER categoria_valor_sessao'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

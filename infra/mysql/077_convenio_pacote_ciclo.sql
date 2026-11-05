-- O pacote de sessões do convênio passa a limitar o custeio de cada paciente.
-- Os acordos vêm em duas formas, "pagamos dez sessões" e "pagamos quatro por
-- mês", e por isso o pacote precisa dizer como é contado. NULL é lido como
-- 'total', a leitura natural de um pacote já cadastrado sem essa informação.
SET @schema_name = DATABASE();
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_convenios' AND column_name = 'pacote_sessoes_ciclo'),
  'SELECT 1',
  'ALTER TABLE clinica_convenios ADD COLUMN pacote_sessoes_ciclo VARCHAR(16) NULL AFTER pacote_sessoes'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

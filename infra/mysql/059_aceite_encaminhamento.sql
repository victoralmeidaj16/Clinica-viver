-- Separa o aceite do encaminhamento da confirmação do primeiro contato.
-- O SLA continua ancorado em alocado_em; aceito_em apenas permite retomar a
-- pergunta "você já chamou este paciente?" ao reabrir o link.
SET @coluna_aceito_em_existe := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_triagens_pacientes'
     AND column_name = 'aceito_em'
);

SET @sql_aceito_em := IF(
  @coluna_aceito_em_existe = 0,
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN aceito_em TIMESTAMP(3) NULL AFTER alocado_em',
  'SELECT 1'
);

PREPARE stmt_aceito_em FROM @sql_aceito_em;
EXECUTE stmt_aceito_em;
DEALLOCATE PREPARE stmt_aceito_em;

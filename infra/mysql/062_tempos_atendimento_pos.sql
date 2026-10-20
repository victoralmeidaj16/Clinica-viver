-- Tempos que o aluno em atendimento supervisionado pode oferecer (50 ou 90 min).
SET @coluna_tempos_atendimento_existe := (
  SELECT COUNT(*)
    FROM information_schema.columns
   WHERE table_schema = DATABASE()
     AND table_name = 'clinica_cadastros_psicologos'
     AND column_name = 'tempos_atendimento'
);

SET @sql_tempos_atendimento := IF(
  @coluna_tempos_atendimento_existe = 0,
  'ALTER TABLE clinica_cadastros_psicologos ADD COLUMN tempos_atendimento JSON NULL AFTER servicos_prestados',
  'SELECT 1'
);

PREPARE stmt_tempos_atendimento FROM @sql_tempos_atendimento;
EXECUTE stmt_tempos_atendimento;
DEALLOCATE PREPARE stmt_tempos_atendimento;

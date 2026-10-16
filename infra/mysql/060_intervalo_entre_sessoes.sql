-- Intervalo entre uma sessão e a próxima dentro da mesma janela recorrente.
--
-- Sem ele, a janela de 18:00 às 22:00 com 50 minutos oferece 18:00, 18:50,
-- 19:40 e 20:30, sem respiro para anotar a sessão ou receber o próximo
-- paciente. O padrão 0 mantém as grades já salvas exatamente como estão.
SET @coluna_intervalo_existe := (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'clinica_disponibilidades'
     AND column_name = 'intervalo_min'
);
SET @sql_intervalo := IF(
  @coluna_intervalo_existe = 0,
  'ALTER TABLE clinica_disponibilidades ADD COLUMN intervalo_min SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER duracao_min',
  'SELECT 1'
);
PREPARE stmt_intervalo FROM @sql_intervalo;
EXECUTE stmt_intervalo;
DEALLOCATE PREPARE stmt_intervalo;

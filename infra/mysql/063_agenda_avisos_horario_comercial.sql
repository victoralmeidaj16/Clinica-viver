-- Confirmação ao paciente só em horário comercial.
--
-- Fora do expediente, a reserva nasce em `aguardando_horario` com `enviar_em`
-- na próxima abertura; o worker da varredura a libera. `descartada` registra a
-- confirmação que não saiu porque a sessão foi cancelada ou já passou.
ALTER TABLE clinica_agenda_avisos MODIFY COLUMN situacao ENUM(
  'reservado', 'enviada', 'bloqueada_allowlist', 'provedor_desconfigurado',
  'aguardando_horario', 'descartada'
) NOT NULL DEFAULT 'reservado';
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'clinica_agenda_avisos' AND column_name = 'enviar_em'),
  'SELECT 1', 'ALTER TABLE clinica_agenda_avisos ADD COLUMN enviar_em TIMESTAMP(3) NULL');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'clinica_agenda_avisos' AND index_name = 'clinica_agenda_avisos_fila_idx'),
  'SELECT 1', 'ALTER TABLE clinica_agenda_avisos ADD KEY clinica_agenda_avisos_fila_idx (instituicao_id, situacao, enviar_em)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

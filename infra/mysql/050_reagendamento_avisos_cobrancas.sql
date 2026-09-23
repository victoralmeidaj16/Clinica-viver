-- Avisos distintos para cada alteração, inclusive ao voltar a um horário anterior.
ALTER TABLE clinica_agenda_avisos MODIFY COLUMN tipo ENUM(
  'confirmacao_paciente', 'confirmacao_psicologo', 'cancelamento_paciente',
  'remarcacao_paciente', 'remarcacao_psicologo'
) NOT NULL;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'clinica_agenda_avisos' AND column_name = 'versao'),
  'SELECT 1', 'ALTER TABLE clinica_agenda_avisos ADD COLUMN versao INT NOT NULL DEFAULT 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.statistics
  WHERE table_schema = DATABASE() AND table_name = 'clinica_agenda_avisos'
    AND index_name = 'clinica_agenda_avisos_uq' AND column_name = 'versao'),
  'SELECT 1', 'ALTER TABLE clinica_agenda_avisos DROP INDEX clinica_agenda_avisos_uq,
    ADD UNIQUE KEY clinica_agenda_avisos_uq (agendamento_id, tipo, versao)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Gravada na transação da agenda. A rede só é acessada após o commit.
-- O plano permanece até a conclusão, para retomar após falha ou reinício.
CREATE TABLE IF NOT EXISTS financeiro_ajustes_vencimento (
  id CHAR(36) NOT NULL PRIMARY KEY,
  instituicao_id CHAR(36) NOT NULL,
  agendamento_id CHAR(36) NOT NULL,
  vence_em TIMESTAMP(3) NOT NULL,
  plano JSON NOT NULL,
  situacao ENUM('pending', 'completed', 'paid') NOT NULL DEFAULT 'pending',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  KEY ajustes_pendentes (instituicao_id, situacao, agendamento_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

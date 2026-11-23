-- Paciente do Projeto Acolhe (especificação final de fluxos, 6.02 e seção 15).
--
-- O cadastro manual ocupa vaga no limite de pacientes ativos do psicólogo,
-- exceto quando o paciente vem do Projeto Acolhe. A marcação fica no vínculo
-- (`clinica_triagens_pacientes`), que é o que o contador de vagas lê.
--
-- Idempotente: aplicável a banco novo e a instalação já em produção. Registros
-- existentes recebem 0 — nenhum vínculo atual muda de contagem.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'projeto_acolhe'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN projeto_acolhe TINYINT(1) NOT NULL DEFAULT 0 AFTER psicologos_ja_tentados'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

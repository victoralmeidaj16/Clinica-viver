-- Custeio personalizado: a empresa cobre uma quantidade de sessões, o paciente
-- paga o restante.
--
-- Até aqui o custeio era um booleano do paciente — `custeado_pela_empresa`
-- NULL herda a política do convênio, 0 e 1 são exceções — e valia para todas as
-- sessões, para sempre. Não cabia o arranjo mais comum das empresas parceiras:
-- "pagamos dez sessões" ou "pagamos quatro por mês". Quem tinha esse acordo era
-- cadastrado como custeado e a clínica cobrava a empresa por sessões que ela
-- nunca concordou em pagar, ou era cadastrado como não custeado e o benefício
-- simplesmente não existia no sistema.
--
-- `custeio_sessoes_cota` guarda a quantidade e `custeio_sessoes_ciclo` diz se
-- ela é um total do vínculo ('total') ou se reabre a cada mês ('mensal').
-- Ambos NULL preservam exatamente o comportamento antigo — cota ilimitada —,
-- que é o de todo paciente já gravado.
--
-- A cota só faz sentido junto de uma decisão por sessão, e é isso que
-- `clinica_agendamentos.custeado_pela_empresa` passa a guardar: NULL enquanto
-- ninguém decidiu, 1 quando aquela sessão consumiu a cota da empresa, 0 quando
-- coube ao paciente. Sem essa coluna, contar o consumo dependeria de reconstruir
-- o passado a cada consulta, e a conta mudaria de resposta quando a gestão
-- editasse a cota — cobrando de novo quem já pagou. Quem decide é a confirmação
-- de realização, porque foi ela que o acordo comprou; agendamento cancelado não
-- queima benefício nenhum.
--
-- Idempotente: aplicável a banco novo e a instalação já em produção.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_pacientes'
            AND column_name = 'custeio_sessoes_cota'),
  'SELECT 1',
  'ALTER TABLE clinica_pacientes ADD COLUMN custeio_sessoes_cota SMALLINT UNSIGNED NULL AFTER custeado_pela_empresa'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_pacientes'
            AND column_name = 'custeio_sessoes_ciclo'),
  'SELECT 1',
  'ALTER TABLE clinica_pacientes ADD COLUMN custeio_sessoes_ciclo VARCHAR(16) NULL AFTER custeio_sessoes_cota'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_agendamentos'
            AND column_name = 'custeado_pela_empresa'),
  'SELECT 1',
  'ALTER TABLE clinica_agendamentos ADD COLUMN custeado_pela_empresa TINYINT(1) NULL AFTER valor_centavos'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- A contagem do consumo roda dentro da transação que confirma a realização, com
-- o agendamento já travado. Sem índice ela varreria a agenda inteira segurando
-- esse lock.
SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.statistics
          WHERE table_schema = @schema_name AND table_name = 'clinica_agendamentos'
            AND index_name = 'clinica_agendamentos_custeio_idx'),
  'SELECT 1',
  'CREATE INDEX clinica_agendamentos_custeio_idx ON clinica_agendamentos (instituicao_id, paciente_id, custeado_pela_empresa, inicio)'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

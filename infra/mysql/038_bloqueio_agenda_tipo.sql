-- Distingue férias/folga (bloqueio de dias inteiros) de um buraco na agenda.
--
-- Os dois já nasciam de `parseAgendaBlockInput` com o campo `tipo`, mas ele era
-- descartado na gravação. Sem essa distinção não dá para decidir o que tira o
-- profissional do rodízio: bloquear uma hora da terça é rotina de agenda;
-- bloquear a semana toda é ausência, e a gestão precisa saber.

SET @schema_name = DATABASE();
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.columns
  WHERE table_schema=@schema_name AND table_name='clinica_agenda_bloqueios'
    AND column_name='tipo'), 'SELECT 1',
  'ALTER TABLE clinica_agenda_bloqueios ADD COLUMN tipo ENUM(''dia'',''horario'') NOT NULL DEFAULT ''horario'' AFTER fim');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Reclassifica o que já está gravado. Um bloqueio de dias inteiros sempre foi
-- construído de meia-noite a meia-noite no fuso da clínica (America/Sao_Paulo,
-- UTC-3 e sem horário de verão desde 2019), então em UTC ele começa às 03:00 e
-- dura um múltiplo exato de 24h. Nenhum bloqueio por horário satisfaz as duas
-- condições, porque o formulário exige fim maior que início no mesmo dia.
UPDATE clinica_agenda_bloqueios
   SET tipo = 'dia'
 WHERE HOUR(inicio) = 3 AND MINUTE(inicio) = 0 AND SECOND(inicio) = 0
   AND HOUR(fim) = 3 AND MINUTE(fim) = 0 AND SECOND(fim) = 0
   AND TIMESTAMPDIFF(HOUR, inicio, fim) >= 24
   AND TIMESTAMPDIFF(HOUR, inicio, fim) % 24 = 0;

-- A gestão lê ausências por profissional e por janela; o índice atual começa
-- em (instituicao_id, profissional_id, inicio, fim) e não cobre a varredura de
-- "quem está ausente agora" em toda a clínica.
SET @sql = IF(EXISTS(SELECT 1 FROM information_schema.statistics
  WHERE table_schema=@schema_name AND table_name='clinica_agenda_bloqueios'
    AND index_name='clinica_agenda_bloq_ausencia_idx'), 'SELECT 1',
  'CREATE INDEX clinica_agenda_bloq_ausencia_idx ON clinica_agenda_bloqueios (instituicao_id, tipo, fim, inicio)');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

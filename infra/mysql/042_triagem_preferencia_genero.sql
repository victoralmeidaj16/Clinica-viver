-- Preferência de gênero do profissional, como critério do rodízio.
--
-- A vitrine já perguntava "prefere psicólogo ou psicóloga?", mas a resposta
-- morria no navegador: recortava a lista de recomendações exibida e nunca era
-- enviada. Quem escolhia o caminho da indicação automática podia pedir uma
-- psicóloga e ser encaminhado a um psicólogo, porque o motor de rodízio nunca
-- ficou sabendo do pedido.
--
-- Com a coluna, a preferência vira critério de fila em
-- `selecionarPsicologoRoundRobin` — filtro duro, no mesmo nível de turno e
-- modalidade — e sobrevive ao transbordo de SLA, que reencaminha o lead 24h
-- depois. Não vale para escolha direta de nome nem para reatribuição manual da
-- gestão: nesses dois casos já existe uma decisão humana.
--
-- Guarda só o pedido, não o gênero de ninguém: 'MASCULINO', 'FEMININO' ou
-- ausência. `NULL` e 'SEM_PREFERENCIA' são lidos igual — fila inteira serve —,
-- que é o que mantém os leads gravados antes desta coluna válidos.
--
-- Idempotente: aplicável a banco novo e a instalação já em produção.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns
          WHERE table_schema = @schema_name AND table_name = 'clinica_triagens_pacientes'
            AND column_name = 'preferencia_genero_psicologo'),
  'SELECT 1',
  'ALTER TABLE clinica_triagens_pacientes ADD COLUMN preferencia_genero_psicologo VARCHAR(20) NULL AFTER para_quem_e'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

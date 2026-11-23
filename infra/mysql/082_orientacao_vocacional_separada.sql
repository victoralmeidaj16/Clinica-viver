-- Orientação Vocacional e Orientação Profissional passam a ser modalidades
-- diferentes (especificação final de fluxos, seção 15).
--
-- Até aqui `derivarServicosHabilitados` gravava as duas na mesma chave,
-- `ORIENTACAO_PROFISSIONAL`. Esta migração refaz a mesma derivação sobre o que
-- o próprio profissional declarou em `servicos_prestados`:
--   - quem declarou um rótulo com "Vocacional" ganha `ORIENTACAO_VOCACIONAL`;
--   - quem declarou só "Vocacional", sem nenhum rótulo com "Profissional",
--     perde a `ORIENTACAO_PROFISSIONAL` que vinha apenas da junção antiga.
-- O rótulo combinado "Orientação Vocacional e Profissional" mantém as duas.
-- Cadastros sem `servicos_prestados` não são tocados: não há declaração de
-- origem para decidir.
--
-- Idempotente: as duas atualizações só alcançam linhas ainda fora do estado
-- final.

UPDATE clinica_cadastros_psicologos
   SET servicos_habilitados = JSON_ARRAY_APPEND(servicos_habilitados, '$', 'ORIENTACAO_VOCACIONAL')
 WHERE servicos_prestados IS NOT NULL
   AND JSON_SEARCH(servicos_prestados, 'one', '%Vocacional%') IS NOT NULL
   AND NOT JSON_CONTAINS(servicos_habilitados, '"ORIENTACAO_VOCACIONAL"');

UPDATE clinica_cadastros_psicologos
   SET servicos_habilitados = JSON_REMOVE(
         servicos_habilitados,
         JSON_UNQUOTE(JSON_SEARCH(servicos_habilitados, 'one', 'ORIENTACAO_PROFISSIONAL'))
       )
 WHERE servicos_prestados IS NOT NULL
   AND JSON_SEARCH(servicos_prestados, 'one', '%Vocacional%') IS NOT NULL
   AND JSON_SEARCH(servicos_prestados, 'one', '%Profissional%') IS NULL
   AND JSON_SEARCH(servicos_habilitados, 'one', 'ORIENTACAO_PROFISSIONAL') IS NOT NULL;

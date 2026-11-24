-- Turmas cadastradas pela Gestão (especificação final, 1.01–1.05).
--
-- Antes, as turmas oferecidas no cadastro eram uma lista fixa no código e só o
-- encerramento era gravado (`clinica_turmas_encerradas`), retirando o
-- psicólogo da vitrine no mesmo dia. Esta tabela passa a registrar cada turma
-- de cada pós-graduação, aberta ou encerrada, com as datas e o histórico das
-- decisões. A saída da vitrine acontece no fim do prazo configurado pela
-- Gestão (padrão de três meses, chave `turmas_prazo_saida` em
-- `clinica_configuracoes_gestao`), salvo data definida à mão
-- (`saida_prevista_em`) ou retirada interrompida.
--
-- Carga inicial:
--   * cada encerramento já gravado vira turma encerrada sem data de saída
--     manual: como todo encerramento, ganha o prazo configurado, contado da
--     data em que foi feito. Psicólogos de turma encerrada há menos tempo que
--     o prazo voltam à vitrine e ao rodízio até a data de saída;
--   * cada combinação de pós e turma usada por um psicólogo aprovado vira
--     turma aberta.
--
-- `clinica_turmas_encerradas` continua existindo e é mantida em espelho pela
-- aplicação, para que uma versão anterior do código ainda leia o mesmo estado.
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS clinica_turmas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  pos_graduacao VARCHAR(255) NOT NULL,
  codigo VARCHAR(16) NOT NULL,
  data_inicio DATE NULL,
  data_encerramento_prevista DATE NULL,
  encerrada_em DATE NULL,
  saida_prevista_em DATE NULL,
  retirada_interrompida TINYINT(1) NOT NULL DEFAULT 0,
  historico JSON NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_turmas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_turmas_curso_codigo_uq (instituicao_id, organizacao_ref, pos_graduacao, codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO clinica_turmas
  (id, instituicao_id, organizacao_ref, pos_graduacao, codigo, encerrada_em, saida_prevista_em, historico)
SELECT UUID(), antiga.instituicao_id, antiga.organizacao_ref, antiga.pos_graduacao, UPPER(TRIM(antiga.turma)),
       antiga.encerrada_em, NULL,
       JSON_ARRAY(JSON_OBJECT('acao', 'IMPORTADA', 'em', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.000Z'),
         'detalhe', 'Encerramento anterior ao prazo de saída: passa a seguir o prazo configurado, contado do encerramento.'))
  FROM clinica_turmas_encerradas antiga
 WHERE TRIM(COALESCE(antiga.pos_graduacao, '')) <> '';

INSERT IGNORE INTO clinica_turmas
  (id, instituicao_id, organizacao_ref, pos_graduacao, codigo, historico)
SELECT UUID(), cadastro.instituicao_id, cadastro.organizacao_ref, cadastro.pos_graduacao_viver_mais, cadastro.codigo,
       JSON_ARRAY(JSON_OBJECT('acao', 'IMPORTADA', 'em', DATE_FORMAT(UTC_TIMESTAMP(3), '%Y-%m-%dT%H:%i:%s.000Z'),
         'detalhe', 'Turma em uso por psicólogo aprovado.'))
  FROM (
    SELECT DISTINCT instituicao_id, organizacao_ref, TRIM(pos_graduacao_viver_mais) AS pos_graduacao_viver_mais,
           UPPER(TRIM(turma_viver_mais)) AS codigo
      FROM clinica_cadastros_psicologos
     WHERE status = 'APROVADO'
       AND TRIM(COALESCE(turma_viver_mais, '')) <> ''
       AND TRIM(COALESCE(pos_graduacao_viver_mais, '')) <> ''
  ) cadastro;

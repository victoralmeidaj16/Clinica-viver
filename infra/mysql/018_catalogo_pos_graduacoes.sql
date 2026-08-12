-- Catálogo institucional das pós-graduações ofertadas pela Viver Mais.
-- A carga é idempotente para poder ser aplicada tanto em bancos novos quanto
-- nos já utilizados pela clínica.

CREATE TABLE IF NOT EXISTS clinica_cursos_pos_graduacao (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  instituicao_id CHAR(36) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_cursos_pos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_cursos_pos_nome_uq (instituicao_id, nome),
  KEY clinica_cursos_pos_ativos_idx (instituicao_id, ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO clinica_cursos_pos_graduacao (instituicao_id, nome)
SELECT i.id, cursos.nome
  FROM instituicoes i
 CROSS JOIN (
   SELECT 'Pós-graduação em Avaliação Psicológica' AS nome
   UNION ALL SELECT 'Programa de Estudos e Pós-graduação em Psicanálise'
   UNION ALL SELECT 'Formação e Pós-graduação em Psicodrama'
   UNION ALL SELECT 'Formação e Pós-graduação em Psicologia Existencialista Clínica'
   UNION ALL SELECT 'Formação e Pós-graduação em Psicologia Junguiana Clínica'
   UNION ALL SELECT 'Pós-graduação em Psicologia Perinatal e Parentalidade'
   UNION ALL SELECT 'Pós-graduação em Psicoterapia de Casal e Família'
   UNION ALL SELECT 'Pós-graduação em Psicoterapia da Sexualidade'
   UNION ALL SELECT 'Pós-graduação em Psicoterapia Infantil e de Adolescentes'
   UNION ALL SELECT 'Pós-graduação em Neuropsicologia Clínica'
   UNION ALL SELECT 'Formação e Pós-graduação em Terapia Cognitivo-Comportamental'
   UNION ALL SELECT 'Pós-graduação em Terapias Cognitivo-Comportamentais de Terceira Geração'
   UNION ALL SELECT 'Formação e Pós-graduação em Terapia Familiar Sistêmica'
   UNION ALL SELECT 'Formação e Pós-graduação em Psicodrama Didata e Psicoterapeuta do Aluno - Nível II'
   UNION ALL SELECT 'Formação e Pós-graduação em Psicodrama Didata Orientador e Supervisor - Nível III'
 ) AS cursos
 WHERE i.slug = 'viver-mais-psicologia'
ON DUPLICATE KEY UPDATE ativo = 1;

-- Valor aberto removido do catálogo: cadastros que o usavam deixam o campo
-- vazio, em vez de manter uma opção que não é ofertada pela instituição.
UPDATE clinica_cadastros_psicologos
   SET pos_graduacao_viver_mais = CASE
         WHEN pos_graduacao_viver_mais = 'Outra Pós-Graduação' THEN NULL
         ELSE pos_graduacao_viver_mais
       END,
       segunda_pos_graduacao_viver_mais = CASE
         WHEN segunda_pos_graduacao_viver_mais = 'Outra Pós-Graduação' THEN NULL
         ELSE segunda_pos_graduacao_viver_mais
       END
 WHERE pos_graduacao_viver_mais = 'Outra Pós-Graduação'
    OR segunda_pos_graduacao_viver_mais = 'Outra Pós-Graduação';

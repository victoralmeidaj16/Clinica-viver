-- Turmas de pós-graduação encerradas pela gestão.
--
-- A clínica existe para os alunos das pós da Viver Mais em curso. Quando uma
-- turma termina, os psicólogos dela saem do rodízio e da vitrine.
--
-- Guarda-se a turma, nunca uma marca em cada cadastro. A saída é derivada a
-- cada leitura (`lib/turmaEncerrada.ts`), como as férias da agenda: reabrir a
-- turma (apagar a linha) desfaz tudo sem apagar a pausa manual de ninguém, e
-- quem trocar de turma depois do encerramento deixa de ser afetado.
--
-- Idempotente: aplicável a banco novo e a instalação já em produção.

CREATE TABLE IF NOT EXISTS clinica_turmas_encerradas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  turma VARCHAR(16) NOT NULL,
  encerrada_em DATE NOT NULL,
  encerrada_por VARCHAR(191) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_turmas_encerradas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_turmas_encerradas_uq (instituicao_id, organizacao_ref, turma)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

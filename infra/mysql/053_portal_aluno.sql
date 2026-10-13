-- Portal acadêmico independente: contas de aluno, conteúdo, matrículas e progresso.
-- A identidade acadêmica é deliberadamente separada de clinica_usuarios/membros.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name AND table_name = 'clinica_cursos_pos_graduacao' AND column_name = 'descricao'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_pos_graduacao ADD COLUMN descricao TEXT NULL AFTER nome'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name AND table_name = 'clinica_cursos_pos_graduacao' AND column_name = 'capa_url'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_pos_graduacao ADD COLUMN capa_url VARCHAR(2048) NULL AFTER descricao'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name AND table_name = 'clinica_cursos_pos_graduacao' AND column_name = 'ordem'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_pos_graduacao ADD COLUMN ordem INT UNSIGNED NOT NULL DEFAULT 0 AFTER capa_url'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name AND table_name = 'clinica_cursos_pos_graduacao' AND column_name = 'publicado'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_pos_graduacao ADD COLUMN publicado TINYINT(1) NOT NULL DEFAULT 0 AFTER ativo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS clinica_alunos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  nome_completo VARCHAR(255) NOT NULL,
  email_normalizado VARCHAR(255) NOT NULL,
  telefone VARCHAR(32) NULL,
  senha_hash VARCHAR(255) NOT NULL,
  troca_senha_obrigatoria TINYINT(1) NOT NULL DEFAULT 1,
  status ENUM('active','disabled') NOT NULL DEFAULT 'active',
  criado_por VARCHAR(128) NULL,
  senha_redefinida_por VARCHAR(128) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_alunos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_alunos_email_uq (instituicao_id, email_normalizado),
  KEY clinica_alunos_status_idx (instituicao_id, status, nome_completo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_aluno_matriculas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  aluno_id CHAR(36) NOT NULL,
  curso_id BIGINT UNSIGNED NOT NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_aluno_matriculas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_aluno_matriculas_aluno_fk FOREIGN KEY (aluno_id) REFERENCES clinica_alunos(id),
  CONSTRAINT clinica_aluno_matriculas_curso_fk FOREIGN KEY (curso_id) REFERENCES clinica_cursos_pos_graduacao(id),
  UNIQUE KEY clinica_aluno_matriculas_uq (instituicao_id, aluno_id, curso_id),
  KEY clinica_aluno_matriculas_curso_idx (instituicao_id, curso_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_cursos_modulos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  curso_id BIGINT UNSIGNED NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  ordem INT UNSIGNED NOT NULL DEFAULT 0,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_cursos_modulos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_cursos_modulos_curso_fk FOREIGN KEY (curso_id) REFERENCES clinica_cursos_pos_graduacao(id),
  UNIQUE KEY clinica_cursos_modulos_ordem_uq (instituicao_id, curso_id, ordem),
  KEY clinica_cursos_modulos_curso_idx (instituicao_id, curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_cursos_aulas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  modulo_id CHAR(36) NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  descricao TEXT NULL,
  duracao_min INT UNSIGNED NOT NULL,
  vimeo_id VARCHAR(32) NOT NULL,
  ordem INT UNSIGNED NOT NULL DEFAULT 0,
  publicado TINYINT(1) NOT NULL DEFAULT 0,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_cursos_aulas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_cursos_aulas_modulo_fk FOREIGN KEY (modulo_id) REFERENCES clinica_cursos_modulos(id),
  UNIQUE KEY clinica_cursos_aulas_ordem_uq (instituicao_id, modulo_id, ordem),
  KEY clinica_cursos_aulas_modulo_idx (instituicao_id, modulo_id, publicado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_aluno_progresso_aulas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  aluno_id CHAR(36) NOT NULL,
  aula_id CHAR(36) NOT NULL,
  concluida_em TIMESTAMP(3) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_aluno_progresso_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_aluno_progresso_aluno_fk FOREIGN KEY (aluno_id) REFERENCES clinica_alunos(id),
  CONSTRAINT clinica_aluno_progresso_aula_fk FOREIGN KEY (aula_id) REFERENCES clinica_cursos_aulas(id),
  UNIQUE KEY clinica_aluno_progresso_uq (instituicao_id, aluno_id, aula_id),
  KEY clinica_aluno_progresso_aluno_idx (instituicao_id, aluno_id, concluida_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

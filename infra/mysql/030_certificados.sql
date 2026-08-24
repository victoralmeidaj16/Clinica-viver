-- Sistema de Certificados de Cursos e Pós-Graduações (Viver Mais Psicologia)
-- Armazenamento oficial de certificados emitidos, códigos públicos de validação e modelos visuais.

CREATE TABLE IF NOT EXISTS clinica_certificados (
  id VARCHAR(64) NOT NULL,
  codigo VARCHAR(32) NOT NULL,
  aluno_id VARCHAR(64) NULL,
  aluno_nome VARCHAR(255) NOT NULL,
  aluno_cpf VARCHAR(32) NULL,
  aluno_email VARCHAR(255) NULL,
  curso_id VARCHAR(128) NULL,
  curso_titulo VARCHAR(255) NOT NULL,
  carga_horaria VARCHAR(32) NOT NULL,
  data_emissao VARCHAR(64) NOT NULL,
  data_inicio DATE NULL,
  data_conclusao DATE NULL,
  assinante_info VARCHAR(255) NOT NULL DEFAULT 'VIVIANE OLIVEIRA DE ALMEIDA JEREMIAS:19440737000153',
  url_validacao VARCHAR(255) NOT NULL DEFAULT 'www.vivermaispsicologia.com.br',
  status ENUM('valid', 'revoked', 'cancelled') NOT NULL DEFAULT 'valid',
  motivo_revogacao TEXT NULL,
  revogado_em TIMESTAMP(3) NULL,
  revogado_por VARCHAR(128) NULL,
  frente_imagem_url MEDIUMTEXT NULL,
  verso_imagem_url MEDIUMTEXT NULL,
  carimbo_x DECIMAL(5,2) NULL,
  carimbo_y DECIMAL(5,2) NULL,
  carimbo_font_size DECIMAL(4,1) NULL,
  carimbo_align VARCHAR(16) NULL DEFAULT 'left',
  criado_por VARCHAR(128) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY clinica_certificados_codigo_uq (codigo),
  KEY clinica_certificados_status_idx (status),
  KEY clinica_certificados_aluno_idx (aluno_nome),
  KEY clinica_certificados_curso_idx (curso_titulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_certificados_templates (
  id VARCHAR(64) NOT NULL,
  curso_id VARCHAR(128) NULL,
  nome VARCHAR(255) NOT NULL,
  background_url MEDIUMTEXT NULL,
  background_type VARCHAR(16) NOT NULL DEFAULT 'image',
  second_background_url MEDIUMTEXT NULL,
  second_background_type VARCHAR(16) NOT NULL DEFAULT 'image',
  verification_url VARCHAR(255) NOT NULL DEFAULT 'https://www.vivermaispsicologia.com.br',
  hours_override INT UNSIGNED NULL,
  issue_date_override VARCHAR(32) NULL,
  width_px INT UNSIGNED NOT NULL DEFAULT 1123,
  height_px INT UNSIGNED NOT NULL DEFAULT 794,
  fields_json JSON NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY clinica_certificados_tpl_curso_uq (curso_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Seeds para teste e demonstração imediata
INSERT INTO clinica_certificados (
  id, codigo, aluno_id, aluno_nome, curso_titulo, carga_horaria, data_emissao, data_inicio, data_conclusao, status, criado_por
) VALUES 
(
  'yZV8anjS', 'yZV8anjS', 'u-aluno-1', 'Marina Silva Santos', 
  'Pós-Graduação em Psicoterapia Existencial e Fenomenológica', '360h', '05/03/2026', '2025-03-01', '2026-03-01', 'valid', 'admin@viver.com'
),
(
  'VVR-DEMO-2026', 'VVR-DEMO-2026', 'u-aluno-2', 'Carlos Eduardo Mendes', 
  'Formação Clínica em Manejo da Ansiedade e Pânico', '120h', '15/01/2026', '2025-10-01', '2026-01-10', 'valid', 'admin@viver.com'
),
(
  'REV-TEST-0001', 'REV-TEST-0001', 'u-aluno-3', 'Juliana Rocha', 
  'Introdução à Psicofarmacologia para Psicólogos', '40h', '10/02/2026', '2026-01-05', '2026-02-08', 'revoked', 'admin@viver.com'
)
ON DUPLICATE KEY UPDATE status = VALUES(status);

UPDATE clinica_certificados
   SET motivo_revogacao = 'Inadimplência contratual conforme cláusula 8.2 da Secretaria Acadêmica.',
       revogado_em = '2026-02-20 11:15:00.000',
       revogado_por = 'diretoria@viver.com'
 WHERE codigo = 'REV-TEST-0001' AND motivo_revogacao IS NULL;

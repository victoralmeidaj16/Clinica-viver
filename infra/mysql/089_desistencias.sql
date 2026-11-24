-- Auditoria de desistências no banco (especificação final, 6.06 e 6.09).
--
-- Até aqui ela vivia só no snapshot em arquivo do servidor
-- (`auditoriaDesistencias`), fora das transações e do backup do MySQL. Com a
-- tabela presente, `MysqlDesistenciaRepository` passa a ler e gravar aqui e,
-- na primeira leitura de uma organização sem linhas, importa uma vez os
-- registros do arquivo (`INSERT IGNORE` pela chave única).
--
-- Idempotente.

CREATE TABLE IF NOT EXISTS clinica_desistencias (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  paciente_ref VARCHAR(128) NULL,
  lead_ref VARCHAR(128) NULL,
  paciente_nome VARCHAR(255) NOT NULL,
  psicologo_ref VARCHAR(128) NULL,
  psicologo_nome VARCHAR(255) NOT NULL,
  motivo VARCHAR(40) NOT NULL,
  descricao_detalhada VARCHAR(2000) NULL,
  acao_sugestao VARCHAR(500) NULL,
  data_desistencia TIMESTAMP(3) NOT NULL,
  reengajado TINYINT(1) NOT NULL DEFAULT 0,
  observacoes_reengajamento VARCHAR(1000) NULL,
  permitir_troca_psicologo TINYINT(1) NOT NULL DEFAULT 0,
  registrado_por_usuario_ref VARCHAR(128) NULL,
  registrado_por_perfil ENUM('PSICOLOGO','GESTAO') NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_desistencias_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_desistencias_ref_uq (instituicao_id, organizacao_ref, ref_core),
  KEY clinica_desistencias_paciente_idx (instituicao_id, organizacao_ref, paciente_ref),
  KEY clinica_desistencias_lead_idx (instituicao_id, organizacao_ref, lead_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_agendamentos_alteracoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  agendamento_id CHAR(36) NOT NULL,
  profissional_ref VARCHAR(128) NOT NULL,
  alterado_por_usuario_ref VARCHAR(128) NOT NULL,
  alterado_por_nome VARCHAR(255) NULL,
  alterado_em TIMESTAMP(3) NOT NULL,
  mudancas JSON NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT agendamento_alteracoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY agendamento_alteracoes_data_uq (instituicao_id, agendamento_id, alterado_em),
  KEY agendamento_alteracoes_profissional_idx (instituicao_id, organizacao_ref, profissional_ref, alterado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Configurações operacionais da Gestão (especificação final, 5.02 e 13.02).
--
-- A primeira chave é `prazo_oferta_horas`: o prazo para o psicólogo aceitar ou
-- recusar uma oferta, que começa em 24 horas e a Gestão pode alterar. Cada
-- oferta grava o prazo com que nasceu (`clinica_triagens_pacientes.
-- prazo_resposta_horas`, migration 088), então mudar a configuração vale só
-- para as ofertas seguintes.
--
-- Toda mudança deixa uma linha no histórico com usuário, data, valor anterior
-- e valor novo (13.02).
--
-- Idempotente. Sem linha gravada, a aplicação usa o padrão de 24 horas.

CREATE TABLE IF NOT EXISTS clinica_configuracoes_gestao (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  chave VARCHAR(80) NOT NULL,
  valor JSON NOT NULL,
  atualizado_por_usuario_ref VARCHAR(128) NULL,
  atualizado_por_nome VARCHAR(255) NULL,
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_config_gestao_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_config_gestao_chave_uq (instituicao_id, organizacao_ref, chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_configuracoes_gestao_historico (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_ref VARCHAR(128) NOT NULL,
  chave VARCHAR(80) NOT NULL,
  valor_anterior JSON NULL,
  valor_novo JSON NOT NULL,
  alterado_por_usuario_ref VARCHAR(128) NULL,
  alterado_por_nome VARCHAR(255) NULL,
  alterado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_config_hist_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  KEY clinica_config_hist_chave_idx (instituicao_id, organizacao_ref, chave, alterado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

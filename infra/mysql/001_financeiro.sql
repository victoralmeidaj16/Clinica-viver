-- Fundação MySQL 8 para o primeiro domínio migrado: financeiro + jobs.
-- Execute somente no banco OCI MySQL dedicado à Viver Mais.
--
-- Neste repositório o arquivo entra por **estrutura, não por dado**. Ele é
-- aplicado no banco próprio `viver_mais_clinica`, criado pelo
-- `000_criar_banco_clinica.sh`, e nenhuma linha do banco `viver_mais` do
-- Sponteiro é importada.
--
-- Duas tabelas justificam a presença dele aqui:
--   - `instituicoes`, referenciada por chave estrangeira em toda tabela do 004
--     e do 007;
--   - `financeiro_recebimentos`, referenciada por
--     `clinica_agendamentos.recebimento_id` no 004.
-- Sem elas o 004 não aplica. O domínio financeiro de verdade desta aplicação
-- vive em `packages/core/src/financial` e ganha tabelas próprias no 008 da
-- próxima fase; até lá, as tabelas `financeiro_*` daqui ficam vazias.

CREATE TABLE IF NOT EXISTS instituicoes (
  id CHAR(36) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  nome VARCHAR(255) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY instituicoes_slug_uq (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_recebimentos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  gateway VARCHAR(32) NOT NULL DEFAULT 'asaas',
  gateway_id VARCHAR(128) NOT NULL,
  competencia CHAR(7) NULL,
  descricao VARCHAR(500) NOT NULL,
  valor_centavos BIGINT NOT NULL,
  valor_liquido_centavos BIGINT NOT NULL DEFAULT 0,
  data_vencimento DATE NULL,
  status ENUM('pendente', 'pago', 'atrasado', 'cancelado') NOT NULL,
  meio_pagamento VARCHAR(64) NOT NULL,
  curso_id VARCHAR(128) NULL,
  turma_id VARCHAR(128) NULL,
  aluno_id VARCHAR(128) NULL,
  payload_gateway JSON NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT financeiro_recebimentos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY financeiro_recebimentos_gateway_uq (instituicao_id, gateway, gateway_id),
  KEY financeiro_recebimentos_competencia_idx (instituicao_id, competencia),
  KEY financeiro_recebimentos_status_idx (instituicao_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS financeiro_pendencias (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  recebimento_id CHAR(36) NOT NULL,
  tipo VARCHAR(80) NOT NULL,
  status ENUM('aberta', 'resolvida', 'ignorada') NOT NULL DEFAULT 'aberta',
  motivo VARCHAR(500) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT financeiro_pendencias_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT financeiro_pendencias_recebimento_fk FOREIGN KEY (recebimento_id) REFERENCES financeiro_recebimentos(id),
  UNIQUE KEY financeiro_pendencias_recebimento_tipo_uq (recebimento_id, tipo),
  KEY financeiro_pendencias_abertas_idx (instituicao_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS jobs_execucoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NULL,
  fila VARCHAR(80) NOT NULL,
  chave_idempotencia VARCHAR(255) NOT NULL,
  status ENUM('pendente', 'executando', 'concluido', 'falhou') NOT NULL DEFAULT 'pendente',
  tentativas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  executar_apos TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  iniciado_em TIMESTAMP(3) NULL,
  concluido_em TIMESTAMP(3) NULL,
  payload JSON NULL,
  erro TEXT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT jobs_execucoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY jobs_execucoes_idempotencia_uq (fila, chave_idempotencia),
  KEY jobs_execucoes_fila_idx (fila, status, executar_apos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

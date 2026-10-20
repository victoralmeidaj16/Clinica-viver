-- O paciente propõe um novo horário; somente o profissional confirma a mudança.
CREATE TABLE IF NOT EXISTS clinica_solicitacoes_reagendamento (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  agendamento_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NOT NULL,
  numero INT NOT NULL,
  inicio_atual TIMESTAMP(3) NOT NULL,
  fim_atual TIMESTAMP(3) NOT NULL,
  inicio_solicitado TIMESTAMP(3) NOT NULL,
  fim_solicitado TIMESTAMP(3) NOT NULL,
  modalidade_solicitada ENUM('presencial', 'online', 'telefone') NOT NULL,
  status ENUM('pendente', 'aceita', 'recusada') NOT NULL DEFAULT 'pendente',
  -- NULL não participa de UNIQUE no MySQL; só a pendência repete o id da sessão.
  chave_pendente CHAR(36) GENERATED ALWAYS AS (
    CASE WHEN status = 'pendente' THEN agendamento_id ELSE NULL END
  ) STORED,
  solicitado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  respondido_em TIMESTAMP(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT solicitacoes_reagendamento_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  -- Sem ON DELETE CASCADE: o InnoDB não permite cascade quando a coluna-base
  -- participa da expressão de uma coluna gerada indexada (`chave_pendente`).
  CONSTRAINT solicitacoes_reagendamento_agendamento_fk FOREIGN KEY (agendamento_id) REFERENCES clinica_agendamentos(id),
  CONSTRAINT solicitacoes_reagendamento_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT solicitacoes_reagendamento_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY solicitacoes_reagendamento_pendente_uq (chave_pendente),
  UNIQUE KEY solicitacoes_reagendamento_numero_uq (agendamento_id, numero),
  KEY solicitacoes_reagendamento_profissional_idx (instituicao_id, profissional_id, status, solicitado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE clinica_agenda_avisos MODIFY COLUMN tipo ENUM(
  'confirmacao_paciente', 'confirmacao_psicologo', 'cancelamento_paciente',
  'remarcacao_paciente', 'remarcacao_psicologo',
  'solicitacao_reagendamento_psicologo', 'recusa_reagendamento_paciente'
) NOT NULL;

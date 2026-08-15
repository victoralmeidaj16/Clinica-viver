-- Registro dos avisos de WhatsApp da agenda.
--
-- A deduplicação dos disparos da captação vive num `Set` de processo, e ali é
-- suficiente: a varredura do SLA roda no mesmo host. A agenda não tem esse
-- luxo — o aviso de sessão marcada sai de uma rota pública que pode estar em
-- outra instância, e o lembrete sai de um varredor que roda de hora em hora.
-- Sem uma trava no banco, "reenviar" seria o comportamento normal de um deploy.
--
-- A linha é gravada ANTES do envio, como reserva. Quem conseguiu inserir é
-- quem manda a mensagem; os outros desistem. Falha de rede apaga a reserva
-- para que a próxima varredura tente de novo — bloqueio de allowlist e provedor
-- ausente não apagam, porque tentar de novo daria no mesmo.

CREATE TABLE IF NOT EXISTS clinica_agenda_avisos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  agendamento_id CHAR(36) NOT NULL,
  tipo ENUM(
    'confirmacao_paciente',
    'confirmacao_psicologo',
    'cancelamento_paciente'
  ) NOT NULL,
  situacao ENUM(
    'reservado',
    'enviada',
    'bloqueada_allowlist',
    'provedor_desconfigurado'
  ) NOT NULL DEFAULT 'reservado',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_agenda_avisos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_agenda_avisos_agendamento_fk FOREIGN KEY (agendamento_id) REFERENCES clinica_agendamentos(id) ON DELETE CASCADE,
  -- A trava propriamente dita: um aviso de cada tipo por agendamento.
  UNIQUE KEY clinica_agenda_avisos_uq (agendamento_id, tipo),
  KEY clinica_agenda_avisos_janela_idx (instituicao_id, tipo, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

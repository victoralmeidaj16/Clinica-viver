-- Complemento do 004_clinica.sql para os agregados de @thats-life/core.
-- Aplicar com usuário administrativo, depois do 004; viver_mais_app não tem DDL.
--
-- O 004 modela a clínica como a recepção a vê: paciente, profissional, agenda,
-- evolução, documento, consentimento. O core modela a mesma clínica como um
-- conjunto de agregados com identidade multi-tenant, concorrência otimista,
-- idempotência de comando e outbox. Este arquivo é a diferença entre os dois —
-- não uma segunda modelagem do mesmo domínio.
--
-- Convenções herdadas do 001_financeiro.sql: CHAR(36) como id, instituicao_id
-- em toda tabela, TIMESTAMP(3), InnoDB, utf8mb4_0900_ai_ci e unicidade
-- explícita onde a idempotência precisa ser garantida pelo banco.
--
-- Três decisões que o SQL não explica sozinho:
--
--   1. `ref_core` guarda o id do agregado como o domínio o conhece
--      (`patient-1`, `appointment-3`). A PK continua sendo CHAR(36), derivada
--      por uuidDeterministico(). Sem a coluna, a volta banco → domínio exigiria
--      inverter um hash, que não se inverte.
--   2. Toda escrita de agregado grava, na mesma transação, a linha em
--      clinica_comandos e os eventos em clinica_outbox. Não há transação
--      distribuída entre banco, fila e provedor de pagamento: a compensação é
--      explícita, e o que sustenta isso é a atomicidade local.
--   3. `versao` é concorrência otimista. O UPDATE sempre carrega
--      `WHERE versao = <esperada>`; zero linhas afetadas é conflito, não
--      sucesso silencioso.
--
-- Sessão clínica, revisões SOAP, linha do tempo, ledger financeiro,
-- notificações e check-in pré-sessão ficam para o 008.

-- ---------------------------------------------------------------------------
-- Identidade e multi-tenancy
-- ---------------------------------------------------------------------------

-- `instituicoes` (001) é o tenant de cobrança e o dono das linhas. A
-- organização do core é a unidade clínica dentro dele: tem fuso próprio, tipo e
-- ciclo de vida. Numa instalação de consultório autônomo os dois coincidem;
-- separá-los aqui evita a migração no dia em que não coincidirem.
CREATE TABLE IF NOT EXISTS clinica_organizacoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  tipo ENUM('solo_practice','clinic') NOT NULL DEFAULT 'clinic',
  nome_exibicao VARCHAR(255) NOT NULL,
  razao_social VARCHAR(255) NULL,
  timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  status ENUM('active','suspended','archived') NOT NULL DEFAULT 'active',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_organizacoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_organizacoes_ref_uq (instituicao_id, ref_core)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Identidade global da pessoa que opera o sistema. Credencial, senha e token
-- não pertencem a esta tabela nem ao domínio: o core recebe apenas um principal
-- já verificado pelo adaptador de autenticação.
CREATE TABLE IF NOT EXISTS clinica_usuarios (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  nome_exibicao VARCHAR(255) NOT NULL,
  email_normalizado VARCHAR(255) NULL,
  status ENUM('invited','active','disabled') NOT NULL DEFAULT 'invited',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_usuarios_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_usuarios_ref_uq (instituicao_id, ref_core),
  UNIQUE KEY clinica_usuarios_email_uq (instituicao_id, email_normalizado)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- O vínculo é onde mora a autorização. Papéis em SET porque um vínculo pode
-- combinar `professional` e `billing` — o consultório autônomo em que a mesma
-- pessoa atende e fatura — sem que o papel administrativo conceda acesso
-- clínico.
CREATE TABLE IF NOT EXISTS clinica_membros (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  usuario_ref VARCHAR(128) NOT NULL,
  papeis SET('owner','admin','clinical_director','professional','assistant','billing','auditor') NOT NULL,
  status ENUM('invited','active','disabled') NOT NULL DEFAULT 'invited',
  profissional_id CHAR(36) NULL,
  convidado_por VARCHAR(128) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_membros_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_membros_organizacao_fk FOREIGN KEY (organizacao_id) REFERENCES clinica_organizacoes(id),
  CONSTRAINT clinica_membros_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY clinica_membros_ref_uq (instituicao_id, ref_core),
  -- Uma pessoa tem no máximo um vínculo por organização. É esta chave que
  -- `findMembershipByUser` usa em toda requisição.
  UNIQUE KEY clinica_membros_usuario_uq (organizacao_id, usuario_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_responsaveis (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  organizacao_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  usuario_ref VARCHAR(128) NULL,
  nome_exibicao VARCHAR(255) NOT NULL,
  relacao VARCHAR(80) NOT NULL,
  status ENUM('active','inactive') NOT NULL DEFAULT 'active',
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_responsaveis_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_responsaveis_organizacao_fk FOREIGN KEY (organizacao_id) REFERENCES clinica_organizacoes(id),
  UNIQUE KEY clinica_responsaveis_ref_uq (instituicao_id, ref_core),
  KEY clinica_responsaveis_usuario_idx (organizacao_id, usuario_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Cada capacidade do responsável é concedida individualmente. Nenhuma delas
-- decorre da autoridade: `legal_guardian` não implica acesso a conteúdo
-- clínico compartilhado.
CREATE TABLE IF NOT EXISTS clinica_pacientes_responsaveis (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  responsavel_id CHAR(36) NOT NULL,
  autoridade ENUM('legal_guardian','financial','caregiver') NOT NULL,
  pode_gerir_agenda TINYINT(1) NOT NULL DEFAULT 0,
  pode_ver_financeiro TINYINT(1) NOT NULL DEFAULT 0,
  pode_acessar_conteudo_clinico TINYINT(1) NOT NULL DEFAULT 0,
  pode_gerir_tarefas TINYINT(1) NOT NULL DEFAULT 0,
  pode_gerir_avaliacoes TINYINT(1) NOT NULL DEFAULT 0,
  vigente_de TIMESTAMP(3) NOT NULL,
  vigente_ate TIMESTAMP(3) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_pac_resp_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_pac_resp_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT clinica_pac_resp_responsavel_fk FOREIGN KEY (responsavel_id) REFERENCES clinica_responsaveis(id),
  UNIQUE KEY clinica_pac_resp_ref_uq (instituicao_id, ref_core),
  KEY clinica_pac_resp_paciente_idx (paciente_id, vigente_ate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Ajustes nas tabelas do 004
-- ---------------------------------------------------------------------------
-- O 004 é mantido byte a byte igual ao do repositório Sponteiro: mesmo schema
-- em dois arquivos diferentes é exatamente como as duas versões divergem. Tudo
-- que este produto acrescenta entra por ALTER, aqui.

ALTER TABLE clinica_profissionais
  ADD COLUMN ref_core VARCHAR(128) NULL AFTER instituicao_id,
  ADD COLUMN organizacao_id CHAR(36) NULL AFTER ref_core,
  ADD CONSTRAINT clinica_profissionais_organizacao_fk FOREIGN KEY (organizacao_id) REFERENCES clinica_organizacoes(id),
  ADD UNIQUE KEY clinica_profissionais_ref_uq (instituicao_id, ref_core);

-- `status` do core (active|paused|discharged) não coincide com o `status` do
-- 004 (ativo|fila|inativo): o primeiro descreve o tratamento, o segundo a
-- posição na operação da clínica-escola. Em vez de manter duas colunas que
-- podem se contradizer, o enum é estendido e a leitura tem regra fixa:
--   ativo → active | pausado → paused | alta → discharged
--   fila → paused (na fila de espera não há tratamento em curso)
--   inativo → discharged
ALTER TABLE clinica_pacientes
  ADD COLUMN ref_core VARCHAR(128) NULL AFTER instituicao_id,
  ADD COLUMN organizacao_id CHAR(36) NULL AFTER ref_core,
  ADD COLUMN usuario_ref VARCHAR(128) NULL AFTER pessoa_ref,
  ADD COLUMN referencia_externa VARCHAR(128) NULL AFTER usuario_ref,
  MODIFY COLUMN status ENUM('ativo','fila','pausado','alta','inativo') NOT NULL DEFAULT 'fila',
  ADD CONSTRAINT clinica_pacientes_organizacao_fk FOREIGN KEY (organizacao_id) REFERENCES clinica_organizacoes(id),
  ADD UNIQUE KEY clinica_pacientes_ref_uq (instituicao_id, ref_core),
  ADD KEY clinica_pacientes_usuario_idx (organizacao_id, usuario_ref);

-- O 004 tem um único `profissional_id` por paciente. O core tem profissional
-- principal e lista de atribuídos, e é a lista que decide se um profissional
-- pode abrir o prontuário. Sem esta tabela, "acesso apenas a pacientes
-- atribuídos" não é implementável para quem cobre férias de um colega.
CREATE TABLE IF NOT EXISTS clinica_pacientes_profissionais (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_pac_prof_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_pac_prof_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT clinica_pac_prof_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY clinica_pac_prof_uq (paciente_id, profissional_id),
  KEY clinica_pac_prof_profissional_idx (profissional_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- `duracao_min` continua preenchido para as consultas que o Sponteiro já faz,
-- mas quem manda é `fim`: o agregado tem fim explícito, e derivar minuto de
-- diferença perde precisão em remarcação com duração atípica.
ALTER TABLE clinica_agendamentos
  ADD COLUMN ref_core VARCHAR(128) NULL AFTER instituicao_id,
  ADD COLUMN organizacao_id CHAR(36) NULL AFTER ref_core,
  ADD COLUMN fim TIMESTAMP(3) NULL AFTER inicio,
  ADD COLUMN timezone VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo' AFTER fim,
  ADD COLUMN recorrencia JSON NULL AFTER modalidade,
  ADD COLUMN cancelado_codigo VARCHAR(64) NULL AFTER cancelado_motivo,
  ADD COLUMN sessao_clinica_ref VARCHAR(128) NULL AFTER recebimento_id,
  ADD COLUMN comando_id VARCHAR(128) NULL AFTER sessao_clinica_ref,
  ADD COLUMN versao INT UNSIGNED NOT NULL DEFAULT 1 AFTER comando_id,
  MODIFY COLUMN modalidade ENUM('presencial','online','telefone') NOT NULL,
  ADD CONSTRAINT clinica_agendamentos_organizacao_fk FOREIGN KEY (organizacao_id) REFERENCES clinica_organizacoes(id),
  DROP INDEX clinica_agendamentos_slot_uq,
  -- Cancelamentos são históricos e não ocupam mais o horário. A coluna
  -- gerada mantém a proteção no banco para todo status ativo e retorna NULL
  -- para cancelado, que é ignorado por uma UNIQUE KEY no MySQL.
  ADD COLUMN slot_ocupado TINYINT GENERATED ALWAYS AS (
    CASE WHEN status = 'cancelado' THEN NULL ELSE 1 END
  ) STORED AFTER status,
  ADD UNIQUE KEY clinica_agendamentos_slot_uq (profissional_id, inicio, slot_ocupado),
  ADD UNIQUE KEY clinica_agendamentos_ref_uq (instituicao_id, ref_core),
  ADD KEY clinica_agendamentos_comando_idx (instituicao_id, comando_id);

CREATE TABLE IF NOT EXISTS clinica_agendamentos_lembretes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  ref_core VARCHAR(128) NOT NULL,
  agendamento_id CHAR(36) NOT NULL,
  canal ENUM('email','whatsapp','push') NOT NULL,
  minutos_antes SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT clinica_agend_lembretes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_agend_lembretes_agendamento_fk FOREIGN KEY (agendamento_id) REFERENCES clinica_agendamentos(id) ON DELETE CASCADE,
  UNIQUE KEY clinica_agend_lembretes_uq (agendamento_id, ref_core)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Idempotência e outbox
-- ---------------------------------------------------------------------------

-- Toda mutação da camada de aplicação exige `Idempotency-Key`, e cada etapa da
-- cadeia pós-sessão deriva o próprio `commandId` dela. Repetir a requisição
-- precisa reproduzir o resultado, não duplicar cobrança ou mensagem — e isso
-- só é garantia se a unicidade estiver no banco.
CREATE TABLE IF NOT EXISTS clinica_comandos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  comando_id VARCHAR(128) NOT NULL,
  agregado_tipo VARCHAR(40) NOT NULL,
  agregado_id CHAR(36) NOT NULL,
  agregado_ref VARCHAR(128) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_comandos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  UNIQUE KEY clinica_comandos_uq (instituicao_id, comando_id),
  KEY clinica_comandos_agregado_idx (agregado_tipo, agregado_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Eventos de domínio, gravados na mesma transação do agregado. O consumidor
-- (lembrete, sincronização de calendário, notificação) lê daqui.
--
-- `payload` não carrega SOAP, transcrição, nota clínica, telefone ou e-mail:
-- outbox é infraestrutura, e infraestrutura não é lugar de dado de saúde.
CREATE TABLE IF NOT EXISTS clinica_outbox (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  agregado_tipo VARCHAR(40) NOT NULL,
  agregado_id CHAR(36) NOT NULL,
  tipo_evento VARCHAR(80) NOT NULL,
  correlacao_id VARCHAR(128) NULL,
  payload JSON NOT NULL,
  ocorrido_em TIMESTAMP(3) NOT NULL,
  publicado_em TIMESTAMP(3) NULL,
  tentativas SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_outbox_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  KEY clinica_outbox_pendentes_idx (publicado_em, ocorrido_em),
  KEY clinica_outbox_agregado_idx (agregado_tipo, agregado_id, ocorrido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Domínio clínico: pacientes, agenda, prontuário, comunicação e triagem.
-- Aplicar com usuário administrativo; viver_mais_app não tem DDL.
--
-- Segue as convenções do 001_financeiro.sql: CHAR(36) como id, instituicao_id
-- em toda tabela, TIMESTAMP(3), InnoDB, utf8mb4_0900_ai_ci e unicidade
-- explícita onde a idempotência precisa ser garantida pelo banco, não pela
-- disciplina do código.
--
-- Três regras que o schema não consegue impor sozinho e a aplicação precisa
-- sustentar:
--   1. clinica_evolucoes é append-only: nunca UPDATE, nunca DELETE. Correção
--      entra como linha nova apontando para a anterior por retifica_id.
--   2. Toda leitura de prontuário grava em clinica_acessos_prontuario.
--   3. clinica_profissionais.supervisor_id é obrigatório quando o vínculo é
--      'estagiario'.

-- ---------------------------------------------------------------------------
-- Pessoas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinica_profissionais (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  usuario_ref VARCHAR(128) NOT NULL,     -- uid da autenticação
  nome VARCHAR(255) NOT NULL,
  crp VARCHAR(32) NULL,
  vinculo ENUM('psicologo','estagiario','supervisor') NOT NULL,
  -- WhatsApp do profissional. Deixa de ser cadastro e vira dado operacional:
  -- é para cá que sai a mensagem com o contato da pessoa encaminhada.
  telefone VARCHAR(32) NULL,
  email VARCHAR(255) NULL,
  supervisor_id CHAR(36) NULL,           -- obrigatório na aplicação quando vinculo='estagiario'
  -- Campos de indicação. Sem eles a distribuição de paciente continua sendo
  -- memória de quem está na recepção, que é o que se quer substituir.
  abordagem VARCHAR(120) NULL,
  modalidades SET('presencial','online') NOT NULL DEFAULT 'presencial',
  publicos SET('crianca','adolescente','adulto','idoso','casal','familia') NULL,
  -- Pedido recorrente de quem procura terapia, e filtro real na triagem.
  genero ENUM('feminino','masculino','nao_binario','nao_informado') NOT NULL DEFAULT 'nao_informado',
  atende_libras TINYINT(1) NOT NULL DEFAULT 0,
  idiomas VARCHAR(120) NULL,
  bio VARCHAR(500) NULL,
  valor_sessao_centavos BIGINT NULL,
  valor_social_centavos BIGINT NULL,     -- valor reduzido da clínica-escola
  aceita_novos TINYINT(1) NOT NULL DEFAULT 1,
  vagas_semana SMALLINT UNSIGNED NULL,   -- teto de encaixe; NULL = sem teto declarado
  -- Teto da fila de espera. O matching para de indicar para quem já estourou,
  -- que é o que impede a fila inteira de cair sempre no mesmo profissional.
  fila_maxima SMALLINT UNSIGNED NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_profissionais_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_profissionais_supervisor_fk FOREIGN KEY (supervisor_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY clinica_profissionais_usuario_uq (instituicao_id, usuario_ref),
  KEY clinica_profissionais_indicacao_idx (instituicao_id, ativo, aceita_novos)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Especialidade em tabela própria, não em campo de texto: indicação precisa
-- filtrar por igualdade, e "ansiedade, luto" numa VARCHAR não filtra.
CREATE TABLE IF NOT EXISTS clinica_profissionais_especialidades (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NOT NULL,
  especialidade VARCHAR(80) NOT NULL,    -- vocabulário controlado pela aplicação
  PRIMARY KEY (id),
  CONSTRAINT clinica_prof_esp_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_prof_esp_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY clinica_prof_esp_uq (profissional_id, especialidade),
  KEY clinica_prof_esp_busca_idx (instituicao_id, especialidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_pacientes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  origem_ref VARCHAR(128) NULL,          -- doc id no Firestore durante a coexistência
  pessoa_ref VARCHAR(128) NULL,          -- aluno/egresso vinculado, quando houver
  nome VARCHAR(255) NOT NULL,
  nome_social VARCHAR(255) NULL,
  documento VARCHAR(32) NULL,
  data_nascimento DATE NULL,
  telefone VARCHAR(32) NULL,
  email VARCHAR(255) NULL,
  status ENUM('ativo','fila','inativo') NOT NULL DEFAULT 'fila',
  profissional_id CHAR(36) NULL,
  origem VARCHAR(80) NULL,
  observacao_administrativa VARCHAR(1000) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_pacientes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_pacientes_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY clinica_pacientes_origem_uq (instituicao_id, origem_ref),
  KEY clinica_pacientes_status_idx (instituicao_id, status),
  KEY clinica_pacientes_pessoa_idx (instituicao_id, pessoa_ref),
  -- O robô encontra o paciente pelo telefone antes de qualquer outra coisa.
  KEY clinica_pacientes_telefone_idx (instituicao_id, telefone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;



-- Janelas recorrentes de atendimento. É daqui que sai o horário que o robô
-- oferece: sem isso ele só sabe dizer que "a recepção retorna".
CREATE TABLE IF NOT EXISTS clinica_disponibilidades (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NOT NULL,
  dia_semana TINYINT UNSIGNED NOT NULL,  -- 0=domingo … 6=sábado
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  modalidade ENUM('presencial','online') NOT NULL DEFAULT 'presencial',
  -- Derivado do horário porque a triagem conversa em turno, não em relógio.
  -- Coluna gerada para poder ser filtrada e indexada sem recalcular.
  turno ENUM('manha','tarde','noite') GENERATED ALWAYS AS (
    CASE WHEN hora_inicio < '12:00:00' THEN 'manha'
         WHEN hora_inicio < '18:00:00' THEN 'tarde'
         ELSE 'noite' END
  ) STORED,
  vigencia_inicio DATE NULL,
  vigencia_fim DATE NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_disp_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_disp_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY clinica_disp_janela_uq (profissional_id, dia_semana, hora_inicio, modalidade),
  KEY clinica_disp_agenda_idx (instituicao_id, dia_semana),
  KEY clinica_disp_matching_idx (instituicao_id, turno, dia_semana, modalidade)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Agenda e registro clínico
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinica_agendamentos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  origem_ref VARCHAR(128) NULL,
  paciente_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NOT NULL,
  inicio TIMESTAMP(3) NOT NULL,
  duracao_min SMALLINT UNSIGNED NOT NULL DEFAULT 50,
  modalidade ENUM('presencial','online') NOT NULL,
  local VARCHAR(255) NULL,
  status ENUM('agendado','confirmado','realizado','cancelado','faltou') NOT NULL DEFAULT 'agendado',
  origem_criacao ENUM('recepcao','robo','portal','profissional') NOT NULL DEFAULT 'recepcao',
  confirmado_em TIMESTAMP(3) NULL,
  cancelado_motivo VARCHAR(500) NULL,
  valor_centavos BIGINT NULL,
  recebimento_id CHAR(36) NULL,          -- liga a sessão ao financeiro existente
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_agendamentos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_agendamentos_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT clinica_agendamentos_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  CONSTRAINT clinica_agendamentos_recebimento_fk FOREIGN KEY (recebimento_id) REFERENCES financeiro_recebimentos(id),
  UNIQUE KEY clinica_agendamentos_origem_uq (instituicao_id, origem_ref),
  -- Dois agendamentos no mesmo horário do mesmo profissional são rejeitados
  -- aqui, não na interface. Com robô e recepção marcando ao mesmo tempo, esta
  -- linha deixa de ser zelo e passa a ser o que impede a agenda dobrada.
  UNIQUE KEY clinica_agendamentos_slot_uq (profissional_id, inicio),
  KEY clinica_agendamentos_agenda_idx (instituicao_id, inicio, status),
  KEY clinica_agendamentos_paciente_idx (paciente_id, inicio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Registro clínico. Append-only: correção entra como nova linha apontando para
-- a anterior. A aplicação nunca emite UPDATE nem DELETE aqui.
CREATE TABLE IF NOT EXISTS clinica_evolucoes (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  agendamento_id CHAR(36) NULL,
  profissional_id CHAR(36) NOT NULL,
  tipo ENUM('evolucao','triagem','encerramento','encaminhamento') NOT NULL DEFAULT 'evolucao',
  conteudo MEDIUMTEXT NOT NULL,
  hash_conteudo CHAR(64) NOT NULL,       -- sha-256 do conteúdo normalizado
  retifica_id CHAR(36) NULL,             -- preenchido quando corrige um registro anterior
  assinado_em TIMESTAMP(3) NULL,
  assinatura_ref VARCHAR(255) NULL,      -- token HMAC, padrão de lib/doc-token.ts
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_evolucoes_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_evolucoes_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT clinica_evolucoes_agendamento_fk FOREIGN KEY (agendamento_id) REFERENCES clinica_agendamentos(id),
  CONSTRAINT clinica_evolucoes_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  CONSTRAINT clinica_evolucoes_retifica_fk FOREIGN KEY (retifica_id) REFERENCES clinica_evolucoes(id),
  KEY clinica_evolucoes_paciente_idx (paciente_id, criado_em),
  KEY clinica_evolucoes_profissional_idx (profissional_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_documentos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NOT NULL,
  tipo ENUM('contrato','declaracao','atestado','relatorio','encaminhamento') NOT NULL,
  titulo VARCHAR(255) NOT NULL,
  conteudo MEDIUMTEXT NOT NULL,
  codigo_validacao VARCHAR(64) NOT NULL, -- validação pública, padrão do acadêmico
  arquivo_ref VARCHAR(500) NULL,         -- Object Storage
  emitido_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revogado_em TIMESTAMP(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT clinica_documentos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_documentos_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT clinica_documentos_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  UNIQUE KEY clinica_documentos_codigo_uq (codigo_validacao),
  KEY clinica_documentos_paciente_idx (paciente_id, emitido_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_consentimentos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  finalidade ENUM('atendimento','whatsapp','pesquisa_nps','uso_didatico') NOT NULL,
  versao_texto VARCHAR(32) NOT NULL,
  concedido TINYINT(1) NOT NULL,
  canal VARCHAR(40) NOT NULL,            -- presencial, portal, whatsapp
  registrado_por VARCHAR(128) NOT NULL,
  registrado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  revogado_em TIMESTAMP(3) NULL,
  PRIMARY KEY (id),
  CONSTRAINT clinica_consentimentos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_consentimentos_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  KEY clinica_consentimentos_vigente_idx (paciente_id, finalidade, revogado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Indicação de paciente a profissional
-- ---------------------------------------------------------------------------

-- Uma indicação é uma sugestão registrada, não uma decisão automática. Guardar
-- os critérios usados é o que permite, depois, saber por que a fila anda ou
-- para onde ela empurra sempre as mesmas pessoas.
CREATE TABLE IF NOT EXISTS clinica_encaminhamentos (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  profissional_id CHAR(36) NULL,         -- NULL quando nenhum candidato atendeu aos critérios
  origem ENUM('robo','recepcao','triagem','lista_espera') NOT NULL,
  -- Tema classificado a partir da queixa, em vocabulário controlado. O relato
  -- em texto livre NÃO vem para cá: ele fica na conversa, com retenção curta.
  -- Aqui basta o suficiente para casar com a especialidade do profissional.
  tema VARCHAR(80) NULL,
  modalidade ENUM('presencial','online','indiferente') NOT NULL DEFAULT 'indiferente',
  preferencia_turnos SET('manha','tarde','noite') NULL,
  preferencia_dias SET('dom','seg','ter','qua','qui','sex','sab') NULL,
  criterios JSON NULL,                   -- demais filtros declarados na triagem
  pontuacao SMALLINT NULL,               -- aderência calculada, para ordenar candidatos
  status ENUM('sugerido','notificado','aceito','recusado','agendado','sem_resposta','expirado') NOT NULL DEFAULT 'sugerido',
  motivo VARCHAR(500) NULL,
  -- Momento em que o contato da pessoa foi entregue ao profissional. É um
  -- compartilhamento de dado pessoal: precisa de hora e de responsável.
  notificado_em TIMESTAMP(3) NULL,
  contato_liberado_em TIMESTAMP(3) NULL,
  respondido_em TIMESTAMP(3) NULL,
  decidido_por VARCHAR(128) NULL,
  decidido_em TIMESTAMP(3) NULL,
  agendamento_id CHAR(36) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_encaminhamentos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_encaminhamentos_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT clinica_encaminhamentos_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  CONSTRAINT clinica_encaminhamentos_agendamento_fk FOREIGN KEY (agendamento_id) REFERENCES clinica_agendamentos(id),
  KEY clinica_encaminhamentos_fila_idx (instituicao_id, status, criado_em),
  KEY clinica_encaminhamentos_paciente_idx (paciente_id, criado_em),
  KEY clinica_encaminhamentos_profissional_idx (profissional_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Comunicação
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinica_mensagens (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NULL,
  agendamento_id CHAR(36) NULL,
  -- Nem toda mensagem vai para paciente: o encaminhamento vai para o
  -- profissional, e precisa ser auditável do mesmo jeito.
  profissional_id CHAR(36) NULL,
  encaminhamento_id CHAR(36) NULL,
  canal ENUM('whatsapp','email') NOT NULL DEFAULT 'whatsapp',
  finalidade ENUM('lembrete','confirmacao','cobranca','nps','atendimento','encaminhamento','avulsa') NOT NULL,
  template VARCHAR(120) NULL,
  conteudo TEXT NULL,
  destino VARCHAR(64) NOT NULL,
  provedor_id VARCHAR(128) NULL,
  status ENUM('agendada','enviada','entregue','lida','falhou','bloqueada') NOT NULL DEFAULT 'agendada',
  erro VARCHAR(500) NULL,
  enviar_em TIMESTAMP(3) NOT NULL,
  enviado_em TIMESTAMP(3) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_mensagens_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_mensagens_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  CONSTRAINT clinica_mensagens_agendamento_fk FOREIGN KEY (agendamento_id) REFERENCES clinica_agendamentos(id),
  CONSTRAINT clinica_mensagens_profissional_fk FOREIGN KEY (profissional_id) REFERENCES clinica_profissionais(id),
  CONSTRAINT clinica_mensagens_encaminhamento_fk FOREIGN KEY (encaminhamento_id) REFERENCES clinica_encaminhamentos(id),
  -- Impede que a régua dispare a mesma mensagem duas vezes, no espírito de
  -- financeiro_recebimentos_gateway_uq. A chave é montada pela aplicação
  -- ("lembrete24h:agendamento:<id>", "encaminhamento:<id>") porque nem toda
  -- mensagem tem agendamento — e coluna nula não deduplica em UNIQUE.
  chave_dedupe VARCHAR(160) NULL,
  UNIQUE KEY clinica_mensagens_dedupe_uq (instituicao_id, chave_dedupe),
  KEY clinica_mensagens_fila_idx (status, enviar_em),
  -- O webhook de status chega pelo id do provedor, não pelo nosso.
  KEY clinica_mensagens_provedor_idx (instituicao_id, provedor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Conversa de atendimento pelo WhatsApp.
--
-- A resposta automática obriga a guardar contexto: sem saber em que ponto a
-- pessoa parou, o robô recomeça a cada mensagem. Isso torna conteúdo de
-- terceiro persistente, então valem duas restrições: nada aqui é prontuário
-- (o robô não pergunta queixa, sintoma ou histórico) e a retenção é curta e
-- explícita, por expira_em, diferente da guarda longa da evolução.
CREATE TABLE IF NOT EXISTS clinica_conversas (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  telefone VARCHAR(32) NOT NULL,
  paciente_id CHAR(36) NULL,             -- preenchido quando o telefone é reconhecido
  canal ENUM('whatsapp') NOT NULL DEFAULT 'whatsapp',
  etapa VARCHAR(60) NOT NULL DEFAULT 'inicio',
  contexto JSON NULL,                    -- dados coletados no roteiro, sem conteúdo clínico
  -- Quem responde agora. O robô cala a boca no instante em que um humano
  -- assume, e não volta a falar sozinho naquela conversa.
  responsavel ENUM('robo','humano') NOT NULL DEFAULT 'robo',
  assumida_por VARCHAR(128) NULL,
  assumida_em TIMESTAMP(3) NULL,
  motivo_transferencia ENUM('pedido','urgencia','fora_do_roteiro','horario','erro') NULL,
  ultima_interacao_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  encerrada_em TIMESTAMP(3) NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  atualizado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  -- Coluna gerada só para a unicidade: enquanto a conversa está aberta ela
  -- repete o telefone; encerrada, vira NULL. Assim o banco garante uma única
  -- conversa viva por número e mantém o histórico das anteriores.
  telefone_aberto VARCHAR(32) GENERATED ALWAYS AS (IF(encerrada_em IS NULL, telefone, NULL)) STORED,
  PRIMARY KEY (id),
  CONSTRAINT clinica_conversas_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_conversas_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  UNIQUE KEY clinica_conversas_aberta_uq (instituicao_id, telefone_aberto),
  KEY clinica_conversas_fila_idx (instituicao_id, responsavel, ultima_interacao_em),
  KEY clinica_conversas_telefone_idx (instituicao_id, telefone, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS clinica_conversas_mensagens (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  conversa_id CHAR(36) NOT NULL,
  direcao ENUM('recebida','enviada') NOT NULL,
  autor ENUM('pessoa','robo','humano') NOT NULL,
  conteudo TEXT NOT NULL,
  provedor_id VARCHAR(128) NULL,
  -- Retenção curta e obrigatória. Conversa de triagem não é prontuário e não
  -- herda a guarda de cinco anos; o expurgo roda por esta coluna.
  expira_em TIMESTAMP(3) NOT NULL,
  criado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_conv_msg_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_conv_msg_conversa_fk FOREIGN KEY (conversa_id) REFERENCES clinica_conversas(id),
  UNIQUE KEY clinica_conv_msg_provedor_uq (instituicao_id, provedor_id),
  KEY clinica_conv_msg_conversa_idx (conversa_id, criado_em),
  KEY clinica_conv_msg_expurgo_idx (expira_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
-- Auditoria
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clinica_acessos_prontuario (
  id CHAR(36) NOT NULL,
  instituicao_id CHAR(36) NOT NULL,
  paciente_id CHAR(36) NOT NULL,
  usuario_ref VARCHAR(128) NOT NULL,
  acao ENUM('leitura','escrita','exportacao','impressao') NOT NULL,
  origem_ip VARCHAR(64) NULL,
  detalhe VARCHAR(255) NULL,
  registrado_em TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT clinica_acessos_instituicao_fk FOREIGN KEY (instituicao_id) REFERENCES instituicoes(id),
  CONSTRAINT clinica_acessos_paciente_fk FOREIGN KEY (paciente_id) REFERENCES clinica_pacientes(id),
  KEY clinica_acessos_paciente_idx (paciente_id, registrado_em),
  KEY clinica_acessos_usuario_idx (usuario_ref, registrado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

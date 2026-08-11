-- ⚠️ DADOS FICTÍCIOS — SOMENTE DESENVOLVIMENTO. NÃO APLICAR NA OCI.
--
-- Os dez profissionais aqui são inventados, e os telefones (+5511999990001…)
-- também. Com o Evolution API ligado, telefone de exemplo é telefone de
-- alguém: aplicar este arquivo em produção é criar a possibilidade de a
-- clínica mandar mensagem para um desconhecido.
--
-- Profissionais reais entram por `POST /api/application/professionals`, com
-- CRP verificado. A sequência de produção é 001 → 004 → 007 → 008.
--
-- Seed de Testes: 10 Profissionais da Clínica com especialidades e disponibilidades.
-- Instituição: Viver Mais Psicologia (UUID derivado de SHA-256('instituicao:viver-mais-psicologia'))
-- ID Instituição: 66b591ea-00ae-52f0-8a78-4b654231ae12
--
-- Divergência conhecida em relação à cópia deste arquivo no repositório
-- Sponteiro: lá os ids de profissional são `prof-00000000-0000-...`, com 41
-- caracteres, e a coluna é CHAR(36). O arquivo nunca chegou a ser aplicado, e
-- o erro só aparece na execução — `ERROR 1406: Data too long for column 'id'`.
-- Aqui eles viraram uuids válidos de 36 caracteres. Corrigir também lá antes de
-- aplicar o seed no Sponteiro.

SET @inst_id = '66b591ea-00ae-52f0-8a78-4b654231ae12';

-- Garantir que a instituição exista no banco
INSERT INTO instituicoes (id, slug, nome)
VALUES (@inst_id, 'viver-mais-psicologia', 'Viver Mais Psicologia')
ON DUPLICATE KEY UPDATE nome = VALUES(nome);

-- ---------------------------------------------------------------------------
-- 1. Inserção dos 10 Profissionais
-- ---------------------------------------------------------------------------

INSERT INTO clinica_profissionais (
  id, instituicao_id, usuario_ref, nome, crp, vinculo, telefone, email,
  abordagem, modalidades, publicos, genero, atende_libras, bio,
  valor_sessao_centavos, valor_social_centavos, aceita_novos, vagas_semana, fila_maxima, ativo
) VALUES
-- 1. Dra. Ana Clara Silva (Psicanálise, Adulto/Adolescente, Online/Presencial)
('00000000-0000-4000-8000-000000000001', @inst_id, 'usr-ana-clara', 'Dra. Ana Clara Silva', 'CRP 06/123456', 'psicologo', '+5511999990001', 'ana.clara@vivermais.com.br',
'Psicanálise', 'presencial,online', 'adolescente,adulto', 'feminino', 0, 'Especialista em transtornos de ansiedade e luto.',
18000, 6000, 1, 10, 5, 1),

-- 2. Dr. Bruno Rocha (TCC, Adulto/Casal, Online/Presencial)
('00000000-0000-4000-8000-000000000002', @inst_id, 'usr-bruno-rocha', 'Dr. Bruno Rocha', 'CRP 06/234567', 'psicologo', '+5511999990002', 'bruno.rocha@vivermais.com.br',
'Terapia Cognitivo-Comportamental', 'presencial,online', 'adulto,casal', 'masculino', 0, 'Foco em depressão, burnout e terapia de casal.',
20000, 8000, 1, 8, 4, 1),

-- 3. Dra. Camila Fernandes (Humanista/Gestalt, Criança/Adolescente, Presencial, Libras)
('00000000-0000-4000-8000-000000000003', @inst_id, 'usr-camila-fernandes', 'Dra. Camila Fernandes', 'CRP 06/345678', 'psicologo', '+5511999990003', 'camila.fernandes@vivermais.com.br',
'Gestalt-terapia', 'presencial', 'crianca,adolescente,familia', 'feminino', 1, 'Atendimento infantil e orientação familiar, inclusivo em Libras.',
16000, 5000, 1, 12, 6, 1),

-- 4. Dr. Daniel Oliveira (Análise do Comportamento, Idoso/Adulto, Online)
('00000000-0000-4000-8000-000000000004', @inst_id, 'usr-daniel-oliveira', 'Dr. Daniel Oliveira', 'CRP 06/456789', 'psicologo', '+5511999990004', 'daniel.oliveira@vivermais.com.br',
'Análise do Comportamento (ABA)', 'online', 'adulto,idoso', 'masculino', 0, 'Especialista em gerontologia e saúde mental no envelhecimento.',
19000, 7000, 1, 6, 3, 1),

-- 5. Dra. Elena Martins (Supervisor Clínica, Psicanálise, Todos)
('00000000-0000-4000-8000-000000000005', @inst_id, 'usr-elena-martins', 'Dra. Elena Martins', 'CRP 06/567890', 'supervisor', '+5511999990005', 'elena.martins@vivermais.com.br',
'Psicanálise Vincular', 'presencial,online', 'adulto,idoso,casal,familia', 'feminino', 0, 'Supervisora clínica e terapeuta de casos complexos.',
25000, 10000, 1, 5, 2, 1),

-- 6. Gabriel Santos (Estagiário - sob supervisão da Dra. Elena, TCC)
('00000000-0000-4000-8000-000000000006', @inst_id, 'usr-gabriel-santos', 'Gabriel Santos (Estagiário)', NULL, 'estagiario', '+5511999990006', 'gabriel.santos@vivermais.com.br',
'Cognitivo-Comportamental', 'presencial,online', 'adolescente,adulto', 'masculino', 0, 'Atendimento social sob supervisão clínica.',
5000, 3000, 1, 15, 10, 1),

-- 7. Dra. Helena Souza (Terapia Eschemática, Adulto/Casal, Online)
('00000000-0000-4000-8000-000000000007', @inst_id, 'usr-helena-souza', 'Dra. Helena Souza', 'CRP 06/789012', 'psicologo', '+5511999990007', 'helena.souza@vivermais.com.br',
'Terapia do Esquema', 'online', 'adulto,casal', 'feminino', 0, 'Foco em transtornos de personalidade e relacionamentos.',
22000, 9000, 1, 8, 4, 1),

-- 8. Dr. Igor Lima (Existencial-Fenomenológica, Adulto/Idoso, Presencial)
('00000000-0000-4000-8000-000000000008', @inst_id, 'usr-igor-lima', 'Dr. Igor Lima', 'CRP 06/890123', 'psicologo', '+5511999990008', 'igor.lima@vivermais.com.br',
'Existencialismo', 'presencial', 'adulto,idoso', 'masculino', 0, 'Acompanhamento em crises existenciais, carreira e transições de vida.',
17000, 6000, 1, 10, 5, 1),

-- 9. Dra. Juliana Paes (Sistêmica Familiar, Casal/Família, Presencial/Online)
('00000000-0000-4000-8000-000000000009', @inst_id, 'usr-juliana-paes', 'Dra. Juliana Paes', 'CRP 06/901234', 'psicologo', '+5511999990009', 'juliana.paes@vivermais.com.br',
'Terapia Sistêmica', 'presencial,online', 'casal,familia', 'feminino', 0, 'Especialista em conflitos familiares e dinâmicas de casal.',
21000, 8000, 1, 8, 4, 1),

-- 10. Lucas Mendes (Estagiário - sob supervisão da Dra. Elena, Psicanálise)
('00000000-0000-4000-8000-000000000010', @inst_id, 'usr-lucas-mendes', 'Lucas Mendes (Estagiário)', NULL, 'estagiario', '+5511999990010', 'lucas.mendes@vivermais.com.br',
'Psicanálise', 'presencial,online', 'crianca,adolescente,adulto', 'masculino', 0, 'Atendimento social e clínica-escola.',
5000, 3000, 1, 15, 10, 1)

ON DUPLICATE KEY UPDATE
  nome = VALUES(nome),
  telefone = VALUES(telefone),
  email = VALUES(email),
  ativo = VALUES(ativo);

-- Vincular o supervisor dos estagiários
UPDATE clinica_profissionais
SET supervisor_id = '00000000-0000-4000-8000-000000000005'
WHERE id IN ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000010');

-- ---------------------------------------------------------------------------
-- 2. Especialidades por Profissional
-- ---------------------------------------------------------------------------

INSERT INTO clinica_profissionais_especialidades (id, instituicao_id, profissional_id, especialidade) VALUES
-- Ana Clara
('esp-001', @inst_id, '00000000-0000-4000-8000-000000000001', 'ansiedade'),
('esp-002', @inst_id, '00000000-0000-4000-8000-000000000001', 'luto'),
('esp-003', @inst_id, '00000000-0000-4000-8000-000000000001', 'depressao'),

-- Bruno Rocha
('esp-004', @inst_id, '00000000-0000-4000-8000-000000000002', 'depressao'),
('esp-005', @inst_id, '00000000-0000-4000-8000-000000000002', 'burnout'),
('esp-006', @inst_id, '00000000-0000-4000-8000-000000000002', 'casal'),

-- Camila Fernandes
('esp-007', @inst_id, '00000000-0000-4000-8000-000000000003', 'infantil'),
('esp-008', @inst_id, '00000000-0000-4000-8000-000000000003', 'tdah'),
('esp-009', @inst_id, '00000000-0000-4000-8000-000000000003', 'orientacao_parental'),

-- Daniel Oliveira
('esp-010', @inst_id, '00000000-0000-4000-8000-000000000004', 'idoso'),
('esp-011', @inst_id, '00000000-0000-4000-8000-000000000004', 'autismo'),
('esp-012', @inst_id, '00000000-0000-4000-8000-000000000004', 'reabilitacao_neuro'),

-- Elena Martins
('esp-013', @inst_id, '00000000-0000-4000-8000-000000000005', 'trauma'),
('esp-014', @inst_id, '00000000-0000-4000-8000-000000000005', 'casos_complexos'),

-- Gabriel Santos
('esp-015', @inst_id, '00000000-0000-4000-8000-000000000006', 'ansiedade'),
('esp-016', @inst_id, '00000000-0000-4000-8000-000000000006', 'estresse'),

-- Helena Souza
('esp-017', @inst_id, '00000000-0000-4000-8000-000000000007', 'relacionamentos'),
('esp-018', @inst_id, '00000000-0000-4000-8000-000000000007', 'autoestima'),

-- Igor Lima
('esp-019', @inst_id, '00000000-0000-4000-8000-000000000008', 'carreira'),
('esp-020', @inst_id, '00000000-0000-4000-8000-000000000008', 'existencial'),

-- Juliana Paes
('esp-021', @inst_id, '00000000-0000-4000-8000-000000000009', 'casal'),
('esp-022', @inst_id, '00000000-0000-4000-8000-000000000009', 'familia'),

-- Lucas Mendes
('esp-023', @inst_id, '00000000-0000-4000-8000-000000000010', 'ansiedade'),
('esp-024', @inst_id, '00000000-0000-4000-8000-000000000010', 'autoestima')
ON DUPLICATE KEY UPDATE especialidade = VALUES(especialidade);

-- ---------------------------------------------------------------------------
-- 3. Janelas de Disponibilidade dos Profissionais
-- ---------------------------------------------------------------------------

INSERT INTO clinica_disponibilidades (id, instituicao_id, profissional_id, dia_semana, hora_inicio, hora_fim, modalidade) VALUES
-- Dra. Ana Clara: Segunda e Quarta (Manhã / Tarde - Online e Presencial)
('disp-001', @inst_id, '00000000-0000-4000-8000-000000000001', 1, '08:00:00', '12:00:00', 'presencial'),
('disp-002', @inst_id, '00000000-0000-4000-8000-000000000001', 1, '14:00:00', '18:00:00', 'online'),
('disp-003', @inst_id, '00000000-0000-4000-8000-000000000001', 3, '08:00:00', '12:00:00', 'online'),

-- Dr. Bruno Rocha: Terça e Quinta (Tarde / Noite - Online e Presencial)
('disp-004', @inst_id, '00000000-0000-4000-8000-000000000002', 2, '14:00:00', '18:00:00', 'presencial'),
('disp-005', @inst_id, '00000000-0000-4000-8000-000000000002', 2, '18:00:00', '21:00:00', 'online'),
('disp-006', @inst_id, '00000000-0000-4000-8000-000000000002', 4, '18:00:00', '21:00:00', 'online'),

-- Dra. Camila Fernandes: Segunda, Quarta e Sexta (Tarde - Presencial)
('disp-007', @inst_id, '00000000-0000-4000-8000-000000000003', 1, '13:00:00', '18:00:00', 'presencial'),
('disp-008', @inst_id, '00000000-0000-4000-8000-000000000003', 3, '13:00:00', '18:00:00', 'presencial'),
('disp-009', @inst_id, '00000000-0000-4000-8000-000000000003', 5, '08:00:00', '12:00:00', 'presencial'),

-- Dr. Daniel Oliveira: Segunda e Sexta (Manhã / Noite - Online)
('disp-010', @inst_id, '00000000-0000-4000-8000-000000000004', 1, '09:00:00', '12:00:00', 'online'),
('disp-011', @inst_id, '00000000-0000-4000-8000-000000000004', 5, '18:00:00', '21:00:00', 'online'),

-- Dra. Elena Martins: Quinta (Manhã / Tarde - Presencial)
('disp-012', @inst_id, '00000000-0000-4000-8000-000000000005', 4, '09:00:00', '17:00:00', 'presencial'),

-- Gabriel Santos (Estagiário): Terça e Quinta (Manhã / Tarde)
('disp-013', @inst_id, '00000000-0000-4000-8000-000000000006', 2, '08:00:00', '12:00:00', 'presencial'),
('disp-014', @inst_id, '00000000-0000-4000-8000-000000000006', 4, '13:00:00', '17:00:00', 'online'),

-- Dra. Helena Souza: Quarta e Sexta (Tarde / Noite - Online)
('disp-015', @inst_id, '00000000-0000-4000-8000-000000000007', 3, '14:00:00', '20:00:00', 'online'),
('disp-016', @inst_id, '00000000-0000-4000-8000-000000000007', 5, '14:00:00', '19:00:00', 'online'),

-- Dr. Igor Lima: Segunda e Quarta (Noite - Presencial)
('disp-017', @inst_id, '00000000-0000-4000-8000-000000000008', 1, '18:00:00', '22:00:00', 'presencial'),
('disp-018', @inst_id, '00000000-0000-4000-8000-000000000008', 3, '18:00:00', '22:00:00', 'presencial'),

-- Dra. Juliana Paes: Sábado (Manhã - Presencial/Online)
('disp-019', @inst_id, '00000000-0000-4000-8000-000000000009', 6, '08:00:00', '13:00:00', 'presencial'),
('disp-020', @inst_id, '00000000-0000-4000-8000-000000000009', 6, '14:00:00', '18:00:00', 'online'),

-- Lucas Mendes (Estagiário): Quarta e Sexta (Manhã / Tarde)
('disp-021', @inst_id, '00000000-0000-4000-8000-000000000010', 3, '08:00:00', '12:00:00', 'presencial'),
('disp-022', @inst_id, '00000000-0000-4000-8000-000000000010', 5, '13:00:00', '17:00:00', 'online')
ON DUPLICATE KEY UPDATE
  dia_semana = VALUES(dia_semana),
  hora_inicio = VALUES(hora_inicio),
  hora_fim = VALUES(hora_fim);

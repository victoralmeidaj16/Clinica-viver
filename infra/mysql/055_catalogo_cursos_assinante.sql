-- Conteúdos complementares para a área do aluno/assinante.
-- A carga usa IDs estáveis e verificações por nome para ser reaplicável sem
-- duplicar cursos, módulos ou aulas.

SET @instituicao_id = (
  SELECT id FROM instituicoes WHERE slug = 'viver-mais-psicologia' LIMIT 1
);

INSERT INTO clinica_cursos_pos_graduacao
  (instituicao_id, nome, descricao, ordem, ativo, publicado)
SELECT @instituicao_id, conteudo.nome, conteudo.descricao, conteudo.ordem, 1, 1
  FROM (
    SELECT 'Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos' AS nome,
           'Conteúdo complementar para organização dos documentos e devolutivas dos atendimentos.' AS descricao,
           100 AS ordem
    UNION ALL SELECT 'Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas',
           'Conteúdo complementar sobre profissionalização e regularização do consultório.', 101
    UNION ALL SELECT 'Orientação Parental e os desafios contemporaneos da família',
           'Conteúdo complementar sobre orientação parental e os desafios contemporâneos da família.', 102
    UNION ALL SELECT 'Guia de Carreira: Orientação Profissional e Vocacional na Prática',
           'Conteúdo complementar sobre orientação profissional e vocacional na prática.', 103
  ) AS conteudo
 WHERE @instituicao_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  descricao = VALUES(descricao), ordem = VALUES(ordem), ativo = 1, publicado = 1;

INSERT INTO clinica_cursos_modulos (id, instituicao_id, curso_id, titulo, ordem)
SELECT modulo.id, @instituicao_id, curso.id, 'Aulas', 1
  FROM (
    SELECT '7f42a9a0-1b65-4a9f-86f1-1f4cc4d7b101' AS id,
           'Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos' AS nome
    UNION ALL SELECT '7f42a9a0-1b65-4a9f-86f1-1f4cc4d7b102',
           'Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas'
    UNION ALL SELECT '7f42a9a0-1b65-4a9f-86f1-1f4cc4d7b103',
           'Orientação Parental e os desafios contemporaneos da família'
    UNION ALL SELECT '7f42a9a0-1b65-4a9f-86f1-1f4cc4d7b104',
           'Guia de Carreira: Orientação Profissional e Vocacional na Prática'
  ) AS modulo
  JOIN clinica_cursos_pos_graduacao curso
    ON curso.instituicao_id = @instituicao_id AND curso.nome = modulo.nome
 WHERE @instituicao_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  instituicao_id = VALUES(instituicao_id), curso_id = VALUES(curso_id), titulo = VALUES(titulo), ordem = VALUES(ordem);

INSERT INTO clinica_cursos_aulas
  (id, instituicao_id, modulo_id, titulo, descricao, duracao_min, vimeo_id, vimeo_hash, ordem, publicado)
SELECT aula.id, @instituicao_id, modulo.id, aula.titulo, NULL, 0,
       aula.vimeo_id, aula.vimeo_hash, aula.ordem, 1
  FROM (
    SELECT '8f42a9a0-1b65-4a9f-86f1-1f4cc4d7b201' AS id,
           'Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos' AS curso_nome,
           'Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos' AS titulo,
           '1219246834' AS vimeo_id, NULL AS vimeo_hash, 1 AS ordem
    UNION ALL SELECT '8f42a9a0-1b65-4a9f-86f1-1f4cc4d7b202',
           'Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas',
           'Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas',
           '1218361412', '33ae903e6b', 1
    UNION ALL SELECT '8f42a9a0-1b65-4a9f-86f1-1f4cc4d7b203',
           'Orientação Parental e os desafios contemporaneos da família', 'Aula 1',
           '1225019079', 'd0c9211ec5', 1
    UNION ALL SELECT '8f42a9a0-1b65-4a9f-86f1-1f4cc4d7b204',
           'Orientação Parental e os desafios contemporaneos da família', 'Aula 2',
           '1225389875', 'ca1b0a18a3', 2
    UNION ALL SELECT '8f42a9a0-1b65-4a9f-86f1-1f4cc4d7b205',
           'Guia de Carreira: Orientação Profissional e Vocacional na Prática', 'Aula 1',
           '1223768764', 'efd0cce7d8', 1
    UNION ALL SELECT '8f42a9a0-1b65-4a9f-86f1-1f4cc4d7b206',
           'Guia de Carreira: Orientação Profissional e Vocacional na Prática', 'Aula 2',
           '1223804916', '875b85724b', 2
  ) AS aula
  JOIN clinica_cursos_pos_graduacao curso
    ON curso.instituicao_id = @instituicao_id AND curso.nome = aula.curso_nome
  JOIN clinica_cursos_modulos modulo
    ON modulo.instituicao_id = @instituicao_id AND modulo.curso_id = curso.id AND modulo.titulo = 'Aulas'
 WHERE @instituicao_id IS NOT NULL
ON DUPLICATE KEY UPDATE
  instituicao_id = VALUES(instituicao_id), modulo_id = VALUES(modulo_id), titulo = VALUES(titulo),
  descricao = VALUES(descricao), duracao_min = VALUES(duracao_min), vimeo_id = VALUES(vimeo_id),
  vimeo_hash = VALUES(vimeo_hash), ordem = VALUES(ordem), publicado = 1;

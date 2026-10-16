-- Modelo textual exclusivo de certificado para quatro cursos complementares.
-- Metadados ficam no curso e são copiados ao certificado na emissão.

SET @schema_name = DATABASE();

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_cursos_pos_graduacao' AND column_name = 'professor_certificado'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_pos_graduacao ADD COLUMN professor_certificado VARCHAR(255) NULL AFTER capa_url'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_cursos_pos_graduacao' AND column_name = 'duracao_certificado_min'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_pos_graduacao ADD COLUMN duracao_certificado_min INT UNSIGNED NULL AFTER professor_certificado'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_cursos_pos_graduacao' AND column_name = 'modelo_texto_certificado'),
  'SELECT 1',
  'ALTER TABLE clinica_cursos_pos_graduacao ADD COLUMN modelo_texto_certificado VARCHAR(64) NOT NULL DEFAULT ''standard'' AFTER duracao_certificado_min'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_certificados' AND column_name = 'professor_certificado'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN professor_certificado VARCHAR(255) NULL AFTER curso_titulo'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_certificados' AND column_name = 'duracao_certificado_min'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN duracao_certificado_min INT UNSIGNED NULL AFTER professor_certificado'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql = IF(
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema = @schema_name
    AND table_name = 'clinica_certificados' AND column_name = 'modelo_texto_certificado'),
  'SELECT 1',
  'ALTER TABLE clinica_certificados ADD COLUMN modelo_texto_certificado VARCHAR(64) NOT NULL DEFAULT ''standard'' AFTER duracao_certificado_min'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

UPDATE clinica_cursos_pos_graduacao
   SET professor_certificado = CASE nome
         WHEN 'Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos' THEN 'Esp. Jaqueline Batista Silva Taufembach'
         WHEN 'Orientação Parental e os desafios contemporaneos da família' THEN 'Dra. Rafaela Dias Matavelli'
         WHEN 'Guia de Carreira: Orientação Profissional e Vocacional na Prática' THEN 'Kelly Nayara Thiemann'
         WHEN 'Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas' THEN 'Marlise Alves Silva Teixeira'
       END,
       duracao_certificado_min = CASE nome
         WHEN 'Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos' THEN 90
         WHEN 'Orientação Parental e os desafios contemporaneos da família' THEN 180
         WHEN 'Guia de Carreira: Orientação Profissional e Vocacional na Prática' THEN 210
         WHEN 'Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas' THEN 90
       END,
       modelo_texto_certificado = 'online-course-with-instructor'
 WHERE nome IN (
   'Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos',
   'Orientação Parental e os desafios contemporaneos da família',
   'Guia de Carreira: Orientação Profissional e Vocacional na Prática',
   'Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas'
 );

UPDATE clinica_certificados certificado
JOIN clinica_cursos_pos_graduacao curso
  ON BINARY CAST(curso.id AS CHAR) = BINARY certificado.curso_id
 AND (
   certificado.instituicao_id IS NULL
   OR BINARY certificado.instituicao_id = BINARY curso.instituicao_id
 )
   SET certificado.professor_certificado = curso.professor_certificado,
       certificado.duracao_certificado_min = curso.duracao_certificado_min,
       certificado.modelo_texto_certificado = curso.modelo_texto_certificado,
       certificado.carga_horaria = CASE curso.duracao_certificado_min
         WHEN 90 THEN '1 hora e 30 minutos'
         WHEN 180 THEN '3 horas'
         WHEN 210 THEN '3 horas e 30 minutos'
         ELSE certificado.carga_horaria
       END
 WHERE curso.modelo_texto_certificado = 'online-course-with-instructor';

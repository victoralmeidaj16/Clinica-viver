# Certificados no Portal do Aluno — Especificação Técnica

## 1. Objetivo

Adicionar uma aba de certificados ao portal acadêmico do aluno e emitir automaticamente um certificado de conclusão quando o aluno completar 100% das aulas publicadas de um curso.

O fluxo deve aproveitar o que já existe no projeto: o repositório `clinica_certificados`, o gerador de PDF A4 frente/verso, o QR Code e a validação pública. A referência funcional é o Sponteiro, cujo servidor revalida a conclusão, calcula carga horária/datas e só então disponibiliza o documento.

## 2. Escopo

### Incluído

- item “Certificados” na navegação desktop e mobile do portal do aluno;
- página `/aluno/certificados` com estados de carregamento, erro, vazio, em andamento e disponível;
- endpoint autenticado para listar certificados do aluno logado;
- associação segura do certificado ao `studentId` e à matrícula/curso;
- geração automática e idempotente após a última conclusão de aula publicada;
- botão para visualizar/baixar o PDF já gerado pelo projeto;
- exibição do código e link de validação pública;
- testes unitários e de rota para elegibilidade, idempotência, isolamento e interface principal.

### Fora do escopo

- migração de contas, progresso ou certificados do Sponteiro;
- Firebase, token HMAC do Sponteiro ou cópia literal da interface antiga;
- histórico acadêmico, notas, frequência, assinatura eletrônica ou aprovação manual;
- novo editor de modelos. O painel e os componentes de certificados existentes continuam sendo usados.

## 3. Comportamento funcional

1. O aluno acessa o portal e vê a nova aba “Certificados”.
2. A página consulta somente certificados cujo `aluno_id` pertence ao aluno autenticado e à instituição atual.
3. Para cada curso matriculado, o progresso considera somente aulas publicadas.
4. Ao registrar a conclusão de uma aula, o servidor recalcula o progresso no banco.
5. Se o percentual chegar a 100%, o servidor cria ou recupera o certificado daquele aluno e curso.
6. Repetições da mesma conclusão, recarregamentos ou chamadas concorrentes não criam certificados duplicados.
7. O certificado usa o nome autoritativo do aluno, título do curso, carga horária, data de início, data de conclusão e código único.
8. O aluno pode baixar o PDF por uma rota autorizada. A validação pública continua disponível por código/QR sem expor dados além do certificado validado.

## 4. Arquitetura e dados

### 4.1 Domínio

Adicionar ao domínio acadêmico uma operação pura de elegibilidade:

`isCourseCertificateEligible(lessons, completions) -> boolean`

Ela deve retornar `false` para curso sem aulas publicadas e `true` somente quando todas as aulas publicadas possuírem conclusão. O cálculo deve reutilizar `summarizeCourseProgress` para manter uma única regra de percentual.

### 4.2 Persistência

O certificado precisa carregar `aluno_id` e, preferencialmente, `curso_id`/matrícula para permitir listagem e idempotência. A chave lógica é `(instituicao_id, aluno_id, curso_id)`; o banco deve impedir duplicação com índice único ou o repositório deve garantir a mesma semântica dentro de transação.

Se a tabela atual não possuir `curso_id`, será feita migração compatível com os dados existentes: registros legados permanecem consultáveis e a nova coluna aceita `NULL` apenas para legado; novos certificados automáticos exigem `aluno_id` e `curso_id`.

### 4.3 Serviço acadêmico

O serviço de conclusão de aula passa a:

- validar matrícula ativa, aula publicada e instituição;
- registrar a conclusão de modo idempotente;
- recalcular o curso completo;
- chamar o serviço de certificados apenas quando elegível;
- retornar o progresso e, quando criado/recuperado, um resumo do certificado.

A emissão deve ser server-side e nunca aceitar nome, curso ou elegibilidade fornecidos pelo navegador como autoridade.

### 4.4 Repositório de certificados

Adicionar operações específicas para o portal:

- `listarDoAluno(studentId)`;
- `porAlunoECurso(studentId, courseId)`;
- `emitirAutomatico(input)` com comportamento get-or-create;
- `pdfPermitidoParaAluno(code, studentId)` ou equivalente para autorizar download.

O painel administrativo continua usando as operações existentes de emissão manual e edição de modelos.

## 5. API e telas

### Rotas

- `GET /api/academico/aluno/certificados`: exige sessão de aluno; retorna apenas certificados do aluno atual.
- `GET /api/academico/aluno/certificados/[codigo]/pdf`: exige sessão e confirma pertencimento antes de delegar ao renderizador PDF.
- conclusão de aula existente: dispara a emissão automática depois de persistir a conclusão.

### Página

Criar `/aluno/certificados` e um componente focado, com:

- cabeçalho “Certificados”;
- cards por certificado contendo curso, data de conclusão, carga horária, código e ações “Baixar PDF” e “Validar autenticidade”;
- indicação clara para cursos ainda em andamento;
- estado vazio sem certificados;
- mensagem de erro recuperável.

A página não deve listar certificados de outros alunos mesmo que o cliente altere parâmetros de URL.

## 6. Modelo visual

O modelo recomendado é o já compatível com o projeto: arte de fundo frente/verso em A4 paisagem, QR Code oficial e carimbo/registro no verso. Os campos automáticos permanecem:

- nome do aluno;
- nome do curso;
- data de início;
- data de conclusão;
- carga horária;
- código/link de validação.

O painel administrativo existente será mantido como local de configuração. Não será criado um segundo formato concorrente ao atual.

### 6.1 Texto exclusivo para quatro cursos complementares

O layout visual atual permanece inalterado. Somente os quatro cursos abaixo usam a redação especial:

> Certificamos que **[nome completo do aluno]** concluiu o curso **[nome do curso]**, ministrado pela **[nome da professora]**, promovido pela Viver Mais Psicologia, na modalidade online, com duração de **[duração oficial]**.

| Curso | Professor(a) exibido(a) | Duração oficial |
| --- | --- | --- |
| Gestão de Consultório: Como Elaborar Documentos e Devolutivas dos Atendimentos | Esp. Jaqueline Batista Silva Taufembach | 1 hora e 30 minutos |
| Orientação Parental e os desafios contemporaneos da família | Dra. Rafaela Dias Matavelli | 3 horas |
| Guia de Carreira: Orientação Profissional e Vocacional na Prática | Kelly Nayara Thiemann | 3 horas e 30 minutos |
| Gestão de Consultório: Profissionalização e Regularização do Consultório: Questões Burocráticas | Marlise Alves Silva Teixeira | 1 hora e 30 minutos |

Professor e duração oficial serão metadados do cadastro acadêmico do curso, persistidos no MySQL e editáveis pela gestão. A emissão copia esses valores para o registro do certificado, preservando o conteúdo histórico mesmo que o curso seja alterado depois.

Os demais cursos continuam usando o texto e o cálculo de carga horária atuais. A seleção do texto especial não será inferida pelo título nem fixada em componentes visuais: o curso terá uma configuração explícita de modelo de texto para evitar aplicação acidental a outro curso.

## 7. Segurança e privacidade

- toda consulta do portal deriva `studentId` da sessão;
- toda emissão revalida instituição, matrícula, curso, aulas publicadas e progresso no servidor;
- o endpoint de PDF valida proprietário antes de gerar/entregar o documento;
- códigos continuam únicos e a validação pública informa status revogado/cancelado;
- não expor CPF ou dados clínicos na interface do aluno;
- falhas de emissão não devem apagar a conclusão da aula; a operação pode ser repetida com segurança.
- o texto exclusivo só pode ser aplicado a cursos configurados explicitamente para esse modelo.

## 8. Testes e aceitação

- regra pura: 0 aulas publicadas não é elegível; conclusão parcial não é elegível; 100% é elegível;
- conclusão da última aula cria um certificado;
- concluir novamente ou repetir a requisição retorna o mesmo certificado;
- aluno A não consegue listar, baixar ou consultar por endpoint protegido o certificado do aluno B;
- cursos com aulas despublicadas não exigem conclusão dessas aulas;
- rota de listagem retorna somente dados do aluno autenticado;
- a página renderiza disponível, em andamento e vazio;
- os quatro cursos especiais renderizam professor e duração oficial; um curso comum mantém o texto atual;
- testes existentes de validação pública e geração PDF continuam passando.

## 9. Critérios de aceite

O trabalho estará concluído quando um aluno matriculado puder concluir todas as aulas publicadas de um curso, encontrar automaticamente seu certificado na nova aba, baixar o PDF com o modelo institucional e validar sua autenticidade pelo código/QR, sem duplicação e sem acesso cruzado entre alunos. Para os quatro cursos complementares listados, o documento deve usar exclusivamente a redação especial, o professor e a duração oficial definidos nesta especificação; outros cursos não podem herdar esse texto.

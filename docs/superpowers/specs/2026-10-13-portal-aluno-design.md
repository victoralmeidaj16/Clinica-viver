# Portal do Aluno — Especificação de Design

**Data:** 2026-10-13  
**Status:** aprovado em conversa; aguardando revisão do documento  
**Produto:** Thats Life / Viver Mais Psicologia

## 1. Objetivo

Criar no projeto atual um portal acadêmico com login real e independente para alunos. A primeira entrega permite que a gestão crie contas, matrículas e conteúdo, enquanto o aluno acessa uma visão geral, seus cursos e aulas em vídeo e a própria conta.

O portal se inspira na experiência da área de membros existente no projeto `Sponteiro`, mas será reconstruído na arquitetura atual: Next.js 16, MySQL e os padrões visuais da Clínica Viver Mais. Nenhuma dependência do Firebase ou das credenciais do Sponteiro será trazida.

## 2. Resultado esperado

Ao final desta entrega:

1. A gestão possui uma nova área para administrar alunos, matrículas, cursos, módulos e aulas.
2. Cada aluno usa uma conta acadêmica separada das contas de psicólogo e gestão.
3. O aluno entra por uma página exclusiva, troca a senha temporária no primeiro acesso e vê somente os cursos em que está matriculado.
4. As aulas usam exclusivamente vídeos do Vimeo incorporados ao portal.
5. Uma aula é concluída automaticamente quando o player Vimeo emite o evento de término.
6. O progresso permanece salvo e aparece na visão geral e nos cursos.

## 3. Escopo da primeira entrega

### 3.1 Gestão acadêmica

A navegação administrativa recebe o item **Área de Alunos**, com rota base `/gestao/academico` e três seções:

- **Alunos:** listar, buscar, criar, editar, ativar/desativar e redefinir senha temporária.
- **Cursos e aulas:** criar e editar cursos, módulos e aulas; reordenar conteúdo; publicar e despublicar.
- **Matrículas:** vincular um aluno a um ou mais cursos e ativar ou suspender o vínculo.

Ao criar uma conta, a gestão informa a senha temporária e a entrega manualmente ao aluno. Não haverá convite ou envio de senha por e-mail nesta fase. A senha nunca será recuperável depois de salva; a gestão somente poderá substituí-la por uma nova senha temporária.

### 3.2 Portal do aluno

O portal usa uma navegação própria e separada do cockpit profissional:

- **Visão geral:** saudação, cursos em andamento, percentuais de conclusão e ação para continuar a próxima aula não concluída.
- **Cursos e aulas:** catálogo restrito às matrículas do aluno, detalhes do curso, módulos, aulas e player Vimeo.
- **Minha conta:** edição de dados básicos permitidos e alteração de senha.

Todas as aulas publicadas de um curso matriculado ficam acessíveis. A ordenação orienta o percurso, mas não existe bloqueio sequencial nesta versão.

### 3.3 Fora do escopo

- Calendário acadêmico e aulas ao vivo.
- Financeiro do aluno.
- Certificados e documentos acadêmicos.
- Materiais anexos, quizzes e avaliações.
- Upload ou hospedagem local de vídeos.
- YouTube ou provedores de vídeo diferentes do Vimeo.
- Convites, recuperação ou comunicação por e-mail.
- Migração de contas, senhas, progresso ou conteúdo do Sponteiro.
- Bloqueio sequencial de aulas.
- Prova antifraude de presença ou conclusão para certificação.

## 4. Decisões arquiteturais

### 4.1 Contexto acadêmico isolado

O módulo acadêmico vive no mesmo monorepo, aplicação Next.js e banco MySQL, mas usa modelos, serviços, repositórios, rotas e componentes próprios. Ele não concede ao aluno vínculo de membro da clínica nem qualquer papel da autorização clínica.

A identidade acadêmica não usa `clinica_usuarios` nem `clinica_membros`. Isso permite que a mesma pessoa possua uma conta profissional e uma conta acadêmica independentes, inclusive com o mesmo e-mail, sem colisão de identidade ou herança de permissões.

### 4.2 Autenticação e sessão

- Login acadêmico: `/aluno/login`.
- Cookie de sessão acadêmica: separado do cookie `viver_mais_session`.
- O cookie é assinado, `HttpOnly`, `SameSite=Lax`, `Secure` em produção e tem validade limitada.
- A sessão carrega apenas identificadores acadêmicos e tenant; não contém papel clínico.
- O primeiro login com senha temporária redireciona obrigatoriamente para a troca de senha antes de liberar qualquer conteúdo.
- A sessão acadêmica e a sessão profissional podem coexistir no mesmo navegador.
- Senhas usam o mesmo algoritmo de hash seguro já adotado pelo projeto.
- Senhas definitivas e temporárias exigem ao menos 10 caracteres, incluindo letra e número.

### 4.3 Autorização

- Operações administrativas acadêmicas exigem a sessão administrativa existente.
- Operações do portal exigem sessão acadêmica ativa.
- Toda consulta do portal deriva o aluno da sessão no servidor. `aluno_id` enviado pelo cliente nunca define o escopo da leitura ou escrita.
- Matrícula ativa, curso ativo/publicado e aula publicada são revalidados no servidor antes de entregar conteúdo ou registrar progresso.
- Nenhuma API acadêmica retorna dados clínicos, profissionais ou de outros alunos.

### 4.4 Persistência

Uma nova migração MySQL cria o contexto acadêmico com estas tabelas e responsabilidades:

- `clinica_alunos`: identidade acadêmica, perfil, e-mail normalizado, hash da senha, troca obrigatória, status e auditoria básica.
- `clinica_aluno_matriculas`: vínculo único entre aluno e curso, status e datas.
- `clinica_cursos_modulos`: módulos ordenados de um curso.
- `clinica_cursos_aulas`: aulas ordenadas, conteúdo textual, duração, ID Vimeo e publicação.
- `clinica_aluno_progresso_aulas`: conclusão única por aluno e aula, com data.

A tabela existente `clinica_cursos_pos_graduacao` continua sendo o catálogo institucional e é ampliada com metadados de apresentação, ordenação e publicação. `ativo` controla a disponibilidade administrativa; `publicado` controla a visibilidade no portal.

Todas as tabelas acadêmicas carregam `instituicao_id`. As chaves e índices devem impedir matrícula e conclusão duplicadas e preservar o isolamento entre tenants.

## 5. Modelo funcional

### 5.1 Aluno

Campos essenciais:

- Identificador imutável.
- Instituição.
- Nome completo.
- E-mail normalizado, único dentro do contexto acadêmico da instituição.
- Telefone opcional.
- Hash da senha.
- Indicador de troca obrigatória de senha.
- Status `active` ou `disabled`.
- Datas de criação e atualização.
- Identificador do administrador que criou ou redefiniu o acesso, quando disponível.

Desativar um aluno revoga acesso sem apagar matrículas ou progresso.

### 5.2 Curso, módulo e aula

O curso contém título, descrição, capa opcional, ordem, estado ativo e estado publicado. Um curso contém módulos ordenados; um módulo contém aulas ordenadas.

A aula contém título, descrição opcional, duração em minutos, ordem, ID normalizado do Vimeo e estado publicado. A gestão pode informar um ID numérico ou URL Vimeo válida; o servidor normaliza e rejeita entradas que não resolvam para um ID numérico.

Conteúdo em rascunho permanece visível somente para a gestão.

### 5.3 Matrícula

Um aluno pode possuir várias matrículas. A combinação aluno + curso é única. Suspender uma matrícula remove o curso do portal sem apagar progresso anterior; reativá-la restaura o acesso e o progresso.

### 5.4 Progresso

O portal integra a API oficial do player Vimeo e escuta o evento `ended`. Ao recebê-lo, envia uma requisição autenticada para concluir a aula.

O servidor:

1. Obtém o aluno da sessão.
2. Valida conta e matrícula ativas.
3. Valida curso e aula publicados.
4. Insere a conclusão com chave única aluno + aula.
5. Trata repetições como sucesso idempotente.
6. Devolve o novo resumo de progresso do curso.

O percentual é calculado com base nas aulas publicadas do curso. Alterar a publicação de uma aula pode alterar o denominador e, portanto, o percentual exibido.

O evento do player ocorre no navegador e não é prova antifraude. Ele serve para acompanhamento de consumo, não para certificação nesta fase.

## 6. Rotas e experiência

### 6.1 Gestão

Rota base: `/gestao/academico`.

A página usa abas internas para Alunos, Cursos e aulas, e Matrículas. Formulários e listas são componentes separados, com limite de 250 linhas por componente. Operações destrutivas lógicas, como desativar aluno ou despublicar curso, pedem confirmação e preservam os registros.

### 6.2 Portal

Rotas previstas:

- `/aluno/login`
- `/aluno/trocar-senha`
- `/aluno`
- `/aluno/cursos`
- `/aluno/cursos/[cursoId]`
- `/aluno/aulas/[aulaId]`
- `/aluno/minha-conta`

O shell acadêmico usa identidade visual Viver Mais, navegação responsiva e não renderiza o menu profissional. A experiência de cursos reproduz os padrões úteis do Sponteiro — cards, progresso, grade por módulos e continuidade — adaptados aos tokens e componentes do projeto atual.

### 6.3 Estados de interface

Devem existir estados explícitos para:

- carregamento;
- lista vazia;
- aluno sem matrícula;
- curso sem conteúdo publicado;
- vídeo indisponível ou Vimeo inválido;
- matrícula suspensa;
- conta desativada;
- sessão expirada;
- erro de rede ao registrar progresso;
- sucesso e falha nas operações de gestão.

Se o registro de conclusão falhar, a interface informa o erro e permite repetir sem duplicar dados.

## 7. APIs e fronteiras

As APIs ficam agrupadas por autoridade:

- `/api/academico/auth/*`: login, logout, sessão e troca obrigatória de senha.
- `/api/academico/aluno/*`: perfil, matrículas, catálogo permitido, detalhes e progresso do aluno autenticado.
- `/api/academico/gestao/*`: CRUD administrativo de alunos, cursos, módulos, aulas e matrículas.

As rotas acadêmicas persistentes entram na lista de APIs encaminhadas para o backend da VPS quando o frontend executa na Vercel. Não será criado rewrite global; permanece válida a regra do projeto de encaminhar somente APIs específicas.

As respostas seguem o envelope HTTP já usado pela aplicação. Validação de entrada, autorização e regras de negócio ficam em serviços do servidor, não nos componentes React nem diretamente nos route handlers.

## 8. Privacidade, segurança e operação

- O aluno só acessa o próprio perfil, matrículas e progresso.
- Hashes de senha nunca são retornados por API.
- A senha temporária existe em texto apenas no formulário da gestão antes do envio; depois, só o hash é persistido.
- Logs não devem registrar senhas, cookies ou URLs completas que contenham credenciais.
- Desativação preserva histórico e encerra a validade prática das sessões nas APIs por revalidação do status.
- As URLs de player usam os parâmetros de privacidade suportados pelo Vimeo, incluindo `dnt=1`.
- Registros acadêmicos não devem carregar dados de prontuário ou saúde.

## 9. Estratégia de testes

### 9.1 Regras puras

- Normalização e rejeição de links Vimeo.
- Política de senha.
- Ordenação de módulos e aulas.
- Cálculo de progresso com aulas publicadas.
- Seleção da próxima aula não concluída.

### 9.2 Serviços e persistência

- Criação de aluno com hash e troca obrigatória.
- E-mail acadêmico duplicado na mesma instituição.
- Mesma pessoa/e-mail permitido em identidade profissional e acadêmica.
- Matrícula única, suspensão e reativação.
- Publicação e despublicação.
- Conclusão idempotente.
- Preservação de progresso após suspensão.

### 9.3 Autorização e APIs

- Gestão pode administrar o contexto acadêmico.
- Psicólogo não administrador não pode administrar alunos ou conteúdo.
- Sessão acadêmica não abre rotas clínicas ou administrativas.
- Aluno A não lê nem altera dados do aluno B, mesmo manipulando parâmetros.
- Aluno desativado ou com matrícula suspensa perde acesso imediatamente nas APIs.
- Curso ou aula em rascunho não aparece no portal e não aceita progresso.

### 9.4 Interface e entrega

- Login e troca obrigatória de senha.
- Estados vazio, carregando e erro.
- Jornada gestão cria aluno → matrícula → publica conteúdo → aluno conclui aula.
- Responsividade de gestão e portal.
- `lint`, `typecheck`, suíte Vitest e build de produção.

## 10. Critérios de aceite

1. Um administrador cria um aluno com senha temporária sem afetar contas profissionais.
2. O aluno não acessa o portal antes de trocar a senha temporária.
3. O aluno visualiza apenas cursos matriculados, ativos e publicados.
4. Cursos, módulos e aulas em rascunho permanecem restritos à gestão.
5. A gestão cria e reorganiza módulos e aulas com links exclusivamente Vimeo.
6. O término do vídeo conclui a aula uma única vez e atualiza o percentual.
7. Recarregar a página mantém o progresso.
8. Suspender aluno ou matrícula bloqueia acesso sem apagar histórico.
9. Sessões acadêmica e profissional coexistem sem compartilhar permissões.
10. O portal funciona em desktop e celular e passa nas verificações automatizadas do repositório.

## 11. Evoluções futuras compatíveis

O desenho permite adicionar posteriormente calendário/aulas ao vivo, financeiro, certificados, materiais, quizzes, convites por e-mail e regras sequenciais. Essas capacidades não devem ser parcialmente implementadas agora.

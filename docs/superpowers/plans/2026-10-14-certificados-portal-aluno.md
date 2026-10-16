# Certificados no Portal do Aluno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir certificados no portal do aluno e emiti-los automaticamente, uma única vez, quando todas as aulas publicadas de um curso forem concluídas.

**Architecture:** Reutilizar o domínio acadêmico e o renderizador de certificados existentes. A conclusão de aula continuará sendo a operação de entrada: depois de persistir a conclusão, o serviço recalcula o progresso e chama um repositório de certificados get-or-create, sempre usando dados autoritativos do servidor. Uma rota autenticada lista e entrega apenas certificados pertencentes ao aluno da sessão.

**Status:** As tarefas 1–6 foram implementadas e verificadas. As tarefas 7–10 incorporam o modelo textual exclusivo aprovado posteriormente para quatro cursos complementares.

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Vitest, MySQL via `mysql2/promise`, `@thats-life/core`, Tailwind CSS, PDFKit e QR Code.

**Spec:** `docs/superpowers/specs/2026-10-14-certificados-portal-aluno-design.md`

## Global Constraints

- Componentes devem permanecer modulares e abaixo de 250 linhas.
- A elegibilidade é 100% das aulas publicadas; curso sem aulas publicadas não é elegível.
- `studentId`, nome, curso e progresso devem ser derivados/revalidados no servidor.
- A emissão é idempotente por instituição, aluno e curso.
- Certificados legados continuam consultáveis; novos certificados automáticos carregam aluno, curso e instituição.
- O PDF deve reutilizar o modelo institucional, QR Code e validação pública já existentes.
- Nenhuma credencial, dado ou dependência do Firebase/Sponteiro será importado.
- O layout visual atual permanece inalterado.
- Somente cursos com `certificateTextModel = 'online-course-with-instructor'` usam o texto especial; o título do curso nunca seleciona o modelo em tempo de execução.
- Professor e duração oficial são copiados para o certificado emitido, preservando o histórico após futuras edições do curso.

## Review Focus

- Última aula concluída: o certificado é criado/recuperado depois da conclusão e não antes — cobrir no teste do serviço acadêmico.
- Repetição e concorrência lógica: a mesma matrícula não gera dois certificados — cobrir no teste do repositório.
- Isolamento: aluno A não lista nem baixa certificado de aluno B — cobrir nas rotas autenticadas.
- Curso sem aulas publicadas ou com aula despublicada: não bloquear indevidamente nem emitir falso certificado — cobrir na regra pura.
- Falha ao gerar certificado: a conclusão da aula permanece registrada e a tentativa pode ser repetida — cobrir no serviço.
- Curso comum com professor preenchido por engano: continua com o texto padrão sem o modelo explícito — cobrir no domínio/renderização.
- Curso especial incompleto: gestão recusa publicar/salvar o modelo sem professor ou duração oficial positiva — cobrir no serviço de gestão.
- Certificado já emitido: alterações posteriores no curso não mudam professor, duração ou texto do documento — cobrir no repositório.
- Durações de 90, 180 e 210 minutos: exibir exatamente “1 hora e 30 minutos”, “3 horas” e “3 horas e 30 minutos” — cobrir no core.

---

### Task 1: Fixar a regra de elegibilidade no domínio acadêmico

**Files:**
- Modify: `packages/core/src/academic/rules.ts`
- Test: `packages/core/src/academic/academic.test.ts`

**Interfaces:**
- Consumes: `AcademicLesson`, `LessonCompletion` e `summarizeCourseProgress` existentes.
- Produces: `isCourseCertificateEligible(lessons: readonly AcademicLesson[], completions: readonly LessonCompletion[]): boolean` exportada pelo módulo acadêmico.

- [ ] **Step 1: Write the failing tests**

Adicionar testes para: curso sem aulas publicadas retorna `false`; conclusão parcial retorna `false`; todas as aulas publicadas concluídas retorna `true`; conclusão de aula despublicada não altera a elegibilidade.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run packages/core/src/academic/academic.test.ts`

Expected: FAIL porque `isCourseCertificateEligible` ainda não existe.

- [ ] **Step 3: Implement `isCourseCertificateEligible` in `packages/core/src/academic/rules.ts`**

Filtrar/reutilizar a regra de aulas publicadas por meio de `summarizeCourseProgress` e retornar `total > 0 && percentage === 100`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run packages/core/src/academic/academic.test.ts`

Expected: PASS.

### Task 2: Tornar certificados automáticos identificáveis e idempotentes

**Files:**
- Modify: `packages/core/src/certificados/certificados.ts`
- Modify: `apps/web/src/server/certificados/certificadosRepository.ts`
- Modify: `apps/web/src/server/certificados/certificadosRepository.test.ts`

**Interfaces:**
- Consumes: `CertificateRecord`, `emitir`, `porCodigo` e schema atual `clinica_certificados`.
- Produces: `listarDoAluno(studentId, institutionId?)`, `porAlunoECurso(studentId, courseId, institutionId?)` e `emitirAutomatico(input)` retornando `CertificateRecord`.

- [ ] **Step 1: Write the failing repository tests**

Cobrir que `emitirAutomatico` retorna o mesmo certificado para a mesma instituição/aluno/curso, preserva a associação `studentId`/`courseId`, e que `listarDoAluno` não inclui certificado de outro aluno.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run apps/web/src/server/certificados/certificadosRepository.test.ts`

Expected: FAIL porque as operações automáticas e a persistência das associações ainda não existem.

- [ ] **Step 3: Extend the certificate model and schema**

Adicionar `institutionId?: string` ao `CertificateRecord` quando necessário. Atualizar `ensureTable`/alterações compatíveis para `instituicao_id`, índice único da combinação instituição + aluno + curso para novos registros e preservação de registros legados. Incluir esses campos no mapper, no `INSERT` e no `ON DUPLICATE KEY UPDATE`, sem alterar o comportamento da emissão administrativa existente.

- [ ] **Step 4: Implement `listarDoAluno`, `porAlunoECurso` and `emitirAutomatico`**

No MySQL, filtrar por `instituicao_id` e `aluno_id`; no fallback em memória, aplicar os mesmos filtros. `emitirAutomatico` deve consultar primeiro e, se ausente, emitir com código único e recuperar o registro existente em caso de corrida/duplicidade.

- [ ] **Step 5: Run the focused test to verify it passes**

Run: `npm test -- --run apps/web/src/server/certificados/certificadosRepository.test.ts`

Expected: PASS.

### Task 3: Emitir automaticamente ao concluir o curso

**Files:**
- Modify: `apps/web/src/server/academic/studentPortalService.ts`
- Modify: `apps/web/src/server/academic/studentPortalService.test.ts`
- Modify: `apps/web/src/server/academic/academicRepository.ts` only if the existing interface lacks the required course/enrollment data.

**Interfaces:**
- Consumes: `isCourseCertificateEligible`, `StudentPortalService.completeLesson`, `getCourseTree`, `listCompletions`, `certificadosRepo.emitirAutomatico`.
- Produces: `completeLesson(studentId, lessonId)` returning `{ progress: CourseProgress, certificate?: CertificateSummary }` or an equivalent backward-compatible envelope documented in the implementation.

- [ ] **Step 1: Write the failing service tests**

Adicionar teste para a última aula: registra a conclusão, recalcula 100% e chama emissão com nome do aluno, título, curso, datas e carga horária. Adicionar teste para repetição: a emissão é chamada de forma idempotente. Adicionar teste para erro de emissão: a conclusão/progresso retorna normalmente e uma nova chamada pode tentar emitir novamente.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run apps/web/src/server/academic/studentPortalService.test.ts`

Expected: FAIL porque a conclusão atual só devolve progresso e não chama o repositório de certificados.

- [ ] **Step 3: Implement the automatic issuance flow**

Depois de `completeLesson` e do recálculo, obter o aluno autoritativo, verificar elegibilidade e chamar `emitirAutomatico`. Calcular carga horária a partir das durações publicadas, usar a data da primeira matrícula/conclusão disponível para início, e não deixar falha de certificado desfazer a conclusão. Manter compatibilidade para consumidores que só leem `completed`, `total` e `percentage`.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run apps/web/src/server/academic/studentPortalService.test.ts`

Expected: PASS.

### Task 4: Expor listagem e download protegidos no portal

**Files:**
- Create: `apps/web/src/app/api/academico/aluno/certificados/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/certificados/[codigo]/pdf/route.ts`
- Modify: `apps/web/src/server/academic/studentPortalService.ts` if certificate listing belongs in the student service.
- Test: `apps/web/src/app/api/academico/aluno/route.test.ts` or new focused route tests beside the routes.

**Interfaces:**
- Consumes: `resolveStudentPortal`, `studentApiFailure`, `certificadosRepo.listarDoAluno`, `porCodigo`/authorization helper e o renderizador PDF existente.
- Produces: `GET /api/academico/aluno/certificados` e `GET /api/academico/aluno/certificados/[codigo]/pdf`.

- [ ] **Step 1: Write failing route tests**

Testar resposta autenticada com somente os certificados do aluno, rejeição de acesso sem sessão, rejeição de código pertencente a outro aluno e sucesso do PDF para o proprietário.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- --run apps/web/src/app/api/academico/aluno/route.test.ts`

Expected: FAIL porque as rotas ainda não existem.

- [ ] **Step 3: Implement the list and PDF routes**

Derivar o aluno de `resolveStudentPortal`; nunca aceitar `studentId` de query/body. Para PDF, confirmar `studentId`, instituição e status válido antes de reutilizar a lógica de renderização. Responder com o envelope padrão para JSON e com `application/pdf`/nome de arquivo para download.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- --run apps/web/src/app/api/academico/aluno/route.test.ts`

Expected: PASS.

### Task 5: Adicionar a aba e a página de certificados do aluno

**Files:**
- Create: `apps/web/src/app/aluno/certificados/page.tsx`
- Create: `apps/web/src/components/academic/student/StudentCertificates.tsx`
- Modify: `apps/web/src/components/academic/student/StudentShell.tsx`
- Test: `apps/web/src/components/academic/student/studentViews.test.tsx`

**Interfaces:**
- Consumes: `GET /api/academico/aluno/certificados`, `CertificateRecord`/resumo público e tokens visuais do portal.
- Produces: navegação “Certificados” em desktop/mobile e tela responsiva com vazio, carregamento, erro e cards disponíveis.

- [ ] **Step 1: Write failing component tests**

Testar que a navegação marca `/aluno/certificados` como ativa, que um certificado exibe curso/data/código e ações de PDF/validação, e que a tela vazia informa que ainda não há certificados.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run apps/web/src/components/academic/student/studentViews.test.tsx`

Expected: FAIL porque a aba e o componente ainda não existem.

- [ ] **Step 3: Implement the page and navigation**

Criar um componente abaixo de 250 linhas. Usar links para o endpoint de PDF autenticado e para `/validarcertificados?codigo=...` ou a forma de validação pública já estabelecida. Manter a identidade visual Viver Mais, acessibilidade dos botões e estados de erro recuperáveis.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run apps/web/src/components/academic/student/studentViews.test.tsx`

Expected: PASS.

### Task 6: Verificar integração completa e regressões

**Files:**
- Modify: `apps/web/src/app/api/academico/aluno/route.test.ts` and/or focused tests only when failures reveal an interface incompatibility.
- Modify: `README.md` or academic documentation only if the repository documents portal routes there.

**Interfaces:**
- Consumes: todos os contratos das tarefas 1–5.
- Produces: fluxo completo validado do término da última aula ao download e validação pública.

- [ ] **Step 1: Run all core and web tests**

Run: `npm test`

Expected: PASS sem regressões nos certificados existentes, portal acadêmico, validação pública e geração PDF.

- [ ] **Step 2: Run lint/type checks**

Run: `npm run lint` e `npm run build` no workspace aplicável.

Expected: PASS sem novos erros TypeScript, ESLint ou build do App Router.

- [ ] **Step 3: Execute a verificação manual do fluxo**

Usar um aluno de teste matriculado em curso com pelo menos duas aulas: concluir a primeira, confirmar “em andamento”; concluir a última, confirmar criação única na aba; baixar PDF; conferir QR/código; repetir a chamada e confirmar que a quantidade não aumenta.

- [ ] **Step 4: Review the diff**

Run: `git diff --check` e `git status --short`.

Expected: somente arquivos relacionados a certificados acadêmicos/documentação, sem segredos ou dependências do Sponteiro.

### Task 7: Modelar o texto exclusivo e a duração oficial no domínio

**Files:**
- Modify: `packages/core/src/academic/types.ts`
- Modify: `packages/core/src/certificados/certificados.ts`
- Modify: `packages/core/src/certificados/certificados.test.ts`

**Interfaces:**
- Consumes: `AcademicCourse` e `CertificateRecord` existentes.
- Produces: `CertificateTextModel = 'standard' | 'online-course-with-instructor'`, campos opcionais `certificateInstructor`, `certificateDurationMinutes` e `certificateTextModel` no curso/certificado, `formatCertificateDuration(minutes: number): string` e `certificateBodyText(record: CertificateRecord): string | null`.

- [ ] **Step 1: Write the failing core tests**

Testar as durações `90 -> "1 hora e 30 minutos"`, `180 -> "3 horas"` e `210 -> "3 horas e 30 minutos"`. Testar que `certificateBodyText` retorna a frase aprovada somente para `online-course-with-instructor`, com aluno, curso, professor e duração; para `standard`, retorna `null` mesmo quando professor está preenchido.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test --workspace @thats-life/core -- --run src/certificados/certificados.test.ts`

Expected: FAIL porque os campos e formatadores ainda não existem.

- [ ] **Step 3: Implement the domain contracts and pure formatters**

O texto deve ser exatamente: `Certificamos que [aluno] concluiu o curso [curso], ministrado pela [professora], promovido pela Viver Mais Psicologia, na modalidade online, com duração de [duração].` Retornar `null` se o modelo não for especial ou se professora/duração forem inválidos.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm run test --workspace @thats-life/core -- --run src/certificados/certificados.test.ts`

Expected: PASS.

### Task 8: Persistir e administrar os metadados exclusivos dos cursos

**Files:**
- Create: `infra/mysql/057_certificado_modelo_cursos_especiais.sql`
- Modify: `apps/web/src/server/academic/mysqlAcademicRepository.ts`
- Modify: `apps/web/src/server/academic/academicManagementService.ts`
- Modify: `apps/web/src/components/academic/management/CourseEditor.tsx`
- Modify: `apps/web/src/server/academic/academicManagementService.test.ts`
- Modify: `apps/web/src/server/academic/mysqlAcademicRepository.test.ts`

**Interfaces:**
- Consumes: contratos da Task 7 e CRUD atual de cursos.
- Produces: colunas `professor_certificado`, `duracao_certificado_min` e `modelo_texto_certificado` em `clinica_cursos_pos_graduacao`; campos editáveis pela gestão.

- [ ] **Step 1: Write failing management and repository tests**

Testar leitura/gravação dos três campos, modelo padrão quando ausente e recusa de `online-course-with-instructor` sem professor ou duração maior que zero.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/academicManagementService.test.ts src/server/academic/mysqlAcademicRepository.test.ts`

Expected: FAIL porque o modelo acadêmico e SQL ainda não carregam os campos.

- [ ] **Step 3: Add the idempotent migration and exact four-course seed**

A migração adiciona as três colunas e configura exclusivamente:

- Jaqueline / `90` minutos;
- Rafaela / `180` minutos;
- Kelly / `210` minutos;
- Marlise / `90` minutos.

Usar os títulos completos da especificação no `UPDATE`; nenhum outro curso recebe o modelo especial.

- [ ] **Step 4: Extend repository, service validation and course editor**

Mapear os campos em todos os `SELECT`, `INSERT` e `UPDATE` de curso. No editor, adicionar seletor “Modelo do texto do certificado”, professor e duração oficial em horas/minutos; exibir os dois últimos somente no modelo especial e enviar minutos ao servidor.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/academicManagementService.test.ts src/server/academic/mysqlAcademicRepository.test.ts src/components/academic/management/AcademicManagement.test.tsx`

Expected: PASS.

### Task 9: Copiar os metadados para a emissão e persistência histórica

**Files:**
- Modify: `apps/web/src/server/academic/studentPortalService.ts`
- Modify: `apps/web/src/server/academic/studentPortalService.test.ts`
- Modify: `apps/web/src/server/certificados/certificadosRepository.ts`
- Modify: `apps/web/src/server/certificados/certificadosRepository.test.ts`
- Modify: `infra/mysql/057_certificado_modelo_cursos_especiais.sql`

**Interfaces:**
- Consumes: metadados da Task 8 e `emitirAutomatico` existente.
- Produces: `emitirAutomatico` recebe/copia `certificateInstructor`, `certificateDurationMinutes` e `certificateTextModel`; `CertificateRecord` recuperado mantém os valores emitidos.

- [ ] **Step 1: Write failing issuance and persistence tests**

Testar que curso especial emite com professor/modelo/duração oficial, curso padrão continua usando a carga calculada das aulas, e a alteração posterior no objeto curso não altera o registro já emitido.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/studentPortalService.test.ts src/server/certificados/certificadosRepository.test.ts`

Expected: FAIL porque a emissão ainda não copia os novos campos.

- [ ] **Step 3: Extend certificate schema, mapper and automatic issuance**

Adicionar ao certificado as colunas `professor_certificado`, `duracao_certificado_min` e `modelo_texto_certificado`; incluir no mapper/insert. A migração também preenche certificados existentes ligados a um dos quatro cursos, sem alterar certificados dos demais.

- [ ] **Step 4: Use official duration only for the explicit special model**

No `StudentPortalService`, enviar os metadados do curso. Para o modelo especial, `durationHours` recebe `formatCertificateDuration(certificateDurationMinutes)`; para o padrão, manter o cálculo atual pelas aulas.

- [ ] **Step 5: Run the focused tests to verify they pass**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/studentPortalService.test.ts src/server/certificados/certificadosRepository.test.ts`

Expected: PASS.

### Task 10: Renderizar o texto exclusivo no layout atual e validar regressões

**Files:**
- Modify: `apps/web/src/components/certificados/CertificateDocumentView.tsx`
- Modify: `apps/web/src/app/api/public/certificados/[codigo]/pdf/route.ts`
- Modify: `apps/web/src/components/certificados/CertificateDocumentView.test.tsx` or create a focused render test.
- Modify: `apps/web/src/app/api/public/certificados/[codigo]/pdf/route.test.ts` or create a focused formatter/PDF test.

**Interfaces:**
- Consumes: `certificateBodyText` da Task 7 e o layout atual de certificado.
- Produces: visualização HTML e PDF com o texto especial apenas quando configurado; layout, QR, verso e validação permanecem iguais.

- [ ] **Step 1: Write failing render tests**

Renderizar um certificado especial e afirmar presença da frase, professora e duração oficial. Renderizar um certificado padrão e afirmar ausência de “ministrado pela”, preservando o texto atual.

- [ ] **Step 2: Run focused render tests to verify they fail**

Run: `npm run test --workspace @thats-life/web -- --run CertificateDocumentView`

Expected: FAIL porque os renderizadores ainda não usam `certificateBodyText`.

- [ ] **Step 3: Update HTML and PDF renderers without changing the visual layout**

Na frente sem arte enviada, substituir somente o bloco textual pelo texto retornado para o modelo especial. No PDFKit, quebrar a frase dentro da largura existente e manter nome do aluno/curso em destaque quando possível; QR, verso, código e dimensões A4 não mudam.

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run typecheck && npm run lint && npm run web:build && git diff --check`

Expected: todos os testes e build passam; lint sem novos avisos; o aviso Turbopack preexistente do Asaas pode permanecer.

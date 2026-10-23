# Extração da Plataforma Educacional Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extrair área do aluno, gestão acadêmica e certificados de cursos para o repositório independente `Viver Mais Educacional`, com banco próprio, paridade funcional e URLs públicas preservadas.

**Architecture:** Criar uma aplicação Next.js irmã que usa o banco lógico `viver_mais_educacional` na instância MySQL atual. Migrar código e dados em paralelo, validar a aplicação em origem técnica e então encaminhar somente os prefixos acadêmicos do domínio da clínica; o código antigo permanece disponível para rollback por 30 dias.

**Tech Stack:** Node.js >= 20.19.4, TypeScript 5.7, Next.js 16.4, React 19.2, MySQL 8, mysql2, Vitest 4, Tailwind CSS 3, PDFKit, qrcode-generator, Vercel e Hostinger.

**Spec:** `docs/superpowers/specs/2026-10-23-extracao-plataforma-educacional-design.md`

## Global Constraints

- Componentes novos e componentes divididos devem permanecer abaixo de 250 linhas.
- `Viver Mais Educacional` deve ser uma pasta irmã e um repositório Git independente; não pode importar arquivos de `Clinica Viver Mais` nem depender de `@thats-life/core`.
- O banco de destino é `viver_mais_educacional`, na instância MySQL atual, com credencial de aplicação exclusiva e sem privilégio sobre o banco clínico.
- Gestores acadêmicos, alunos e usuários clínicos usam contas e cookies separados.
- Preservar aparência, comportamento, IDs, códigos, conteúdo dos certificados e jornadas atuais; não adicionar funcionalidades nem redesign.
- `https://clinicavivermais.cloud/painel-certificados` e `/painel-certificados/novo` permanecem com a mesma URL no navegador.
- `https://vivermaispsicologia.com.br/validarcertificados` permanece como endereço público permanente de validação.
- Não criar rewrite global de `/:path*`; encaminhar somente rotas acadêmicas e um prefixo exclusivo de assets.
- Certificado ICP-Brasil, NFS-e, declarações de horas, turmas da clínica-escola e pós-graduação informada no cadastro profissional permanecem na clínica.
- Não usar fallback em memória nem consultar o banco clínico quando o banco educacional estiver indisponível.
- Não excluir código ou tabelas acadêmicas antigas antes de 30 dias de retenção e de aprovação destrutiva específica.

## Review Focus

- Uma falha MySQL durante validação pública deve responder indisponibilidade, nunca “certificado inválido”; o teste pertence à Task 7.
- Cookies de gestor acadêmico, aluno e clínica devem coexistir no mesmo host sem colisão ou aceitação cruzada; os testes pertencem às Tasks 3 e 7.
- Reexecução da cópia inicial ou do delta não pode duplicar registros nem alterar códigos; o teste pertence à Task 8.
- Assets e deep links do projeto educacional devem funcionar por trás do domínio clínico sem capturar `/_next` ou rotas clínicas; o teste pertence à Task 10.
- Escritas ocorridas entre a cópia inicial e a virada não podem desaparecer, e rollback após novas escritas deve exigir reconciliação reversa; o ensaio pertence à Task 11.

---

### Task 1: Criar o repositório independente e os quality gates

**Files:**
- Create: `../Viver Mais Educacional/.gitignore`
- Create: `../Viver Mais Educacional/package.json`
- Create: `../Viver Mais Educacional/package-lock.json`
- Create: `../Viver Mais Educacional/tsconfig.json`
- Create: `../Viver Mais Educacional/next.config.mjs`
- Create: `../Viver Mais Educacional/eslint.config.mjs`
- Create: `../Viver Mais Educacional/postcss.config.mjs`
- Create: `../Viver Mais Educacional/tailwind.config.js`
- Create: `../Viver Mais Educacional/vitest.config.ts`
- Create: `../Viver Mais Educacional/src/app/layout.tsx`
- Create: `../Viver Mais Educacional/src/app/page.tsx`
- Create: `../Viver Mais Educacional/src/app/globals.css`
- Create: `../Viver Mais Educacional/src/architecture.test.ts`
- Create: `../Viver Mais Educacional/README.md`

**Interfaces:**
- Consumes: Node.js `>=20.19.4` e as versões de dependências fixadas no monorepo clínico.
- Produces: scripts `dev`, `build`, `lint`, `typecheck`, `test`, `check`, `db:migrate`, `db:status`, `manager:create`, `data:copy`, `data:reconcile` e uma aplicação Next.js executável.

- [x] **Step 1: Criar a pasta irmã e iniciar o Git independente**

Run:

```bash
mkdir "../Viver Mais Educacional"
git -C "../Viver Mais Educacional" init -b main
```

Expected: `git -C "../Viver Mais Educacional" rev-parse --show-toplevel` termina em `/Viver Mais Educacional` e não aponta para o repositório clínico.

- [x] **Step 2: Criar o scaffold mínimo**

Fixar Next `16.4.3`, React `19.2.3`, TypeScript `^5.7.3`, Vitest `^4.1.10`, Tailwind `^3.4.17`, mysql2 `^3.23.2`, pdfkit `^0.19.1`, qrcode-generator `^2.0.4` e lucide-react `^0.475.0`. A página raiz deve identificar “Viver Mais Educacional” sem incluir funcionalidades novas. A versão do Next foi elevada em relação ao rascunho inicial para incorporar as correções de segurança reportadas pelo `npm audit`.

- [x] **Step 3: Instalar as dependências e gerar o lockfile**

Run: `npm install --prefix "../Viver Mais Educacional"`

Expected: `package-lock.json` existe e `npm ls --prefix "../Viver Mais Educacional" --depth=0` não relata dependências inválidas.

- [x] **Step 4: Escrever o teste de fronteira arquitetural**

Em `src/architecture.test.ts`, testar `sourceFilesRespectRepositoryBoundary` e `sourceFilesStayBelow250Lines`. O primeiro varre `src/**/*.{ts,tsx}` e recusa `@thats-life/core`, `Clinica Viver Mais` e imports que escapem pela pasta pai; o segundo recusa arquivos de produção acima de 250 linhas, excluindo testes e arquivos gerados.

- [x] **Step 5: Executar os quality gates iniciais**

Run: `npm run check --prefix "../Viver Mais Educacional"`

Expected: lint, typecheck, teste arquitetural e build passam.

- [x] **Step 6: Commit no novo repositório**

```bash
git -C "../Viver Mais Educacional" add .
git -C "../Viver Mais Educacional" commit -m "chore: initialize educational platform"
```

### Task 2: Criar esquema e runtime MySQL isolados

**Files:**
- Create: `../Viver Mais Educacional/infra/mysql/001_foundation.sql`
- Create: `../Viver Mais Educacional/infra/mysql/002_academic.sql`
- Create: `../Viver Mais Educacional/infra/mysql/003_certificates.sql`
- Create: `../Viver Mais Educacional/infra/mysql/docker-compose.dev.yml`
- Create: `../Viver Mais Educacional/infra/mysql/README.md`
- Create: `../Viver Mais Educacional/scripts/migrate.mjs`
- Create: `../Viver Mais Educacional/src/server/database/mysql.ts`
- Create: `../Viver Mais Educacional/src/server/database/institution.ts`
- Create: `../Viver Mais Educacional/src/server/database/schema.test.ts`
- Create: `../Viver Mais Educacional/src/server/database/mysql.test.ts`
- Modify: `../Viver Mais Educacional/package.json`
- Modify: `../Viver Mais Educacional/README.md`

**Interfaces:**
- Consumes: `DATABASE_URL` ou `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`; `MYSQL_ADMIN_URL` apenas no migrador; `EDUCATION_INSTITUTION_ID` na aplicação.
- Produces: `isMysqlConfigured(): boolean`, `getMysqlPool(): Pool`, `educationInstitutionId(): string` e as tabelas acadêmicas compatíveis com os IDs atuais.

- [x] **Step 1: Escrever testes de esquema que falham**

`schema.test.ts` deve exigir `instituicoes`, `educacao_gestores`, `clinica_alunos`, `clinica_cursos_pos_graduacao`, `clinica_cursos_modulos`, `clinica_cursos_aulas`, `clinica_aluno_matriculas`, `clinica_aluno_progresso_aulas`, `clinica_certificados` e `clinica_certificados_templates`. Exigir também índices únicos de e-mail do aluno, e-mail do gestor, matrícula, progresso, código do certificado e `(instituicao_id, aluno_id, curso_id)`.

- [x] **Step 2: Confirmar a falha dos testes**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/server/database/schema.test.ts`

Expected: FAIL porque migrations e runtime ainda não existem.

- [x] **Step 3: Implementar migrations independentes e idempotentes**

Portar apenas o DDL necessário das migrations clínicas `018`, `030`, `048`, `049` e `053`–`057`. Preservar nomes e tipos das tabelas acadêmicas, criar `instituicoes` local e criar `educacao_gestores`; não copiar tabelas clínicas nem sementes de produção. Documentar criação de `viver_mais_educacional`, usuário exclusivo e grants mínimos sem registrar senha real.

- [x] **Step 4: Implementar runtime e migrador**

`getMysqlPool()` deve falhar quando não configurado, usar UTC e `dateStrings: true`. O migrador deve conservar controle por checksum e aceitar `--dry-run`; a credencial da aplicação não recebe DDL.

- [ ] **Step 5: Testar banco vazio e privilégios locais**

Pendente por limitação ambiental em 23/10/2026: o Docker CLI está disponível, mas o daemon/socket não está acessível. Os testes unitários do migrador cobrem `--dry-run`, checksum, reaplicação idempotente e divergência; o ensaio integrado real continua obrigatório antes da virada.

Run:

```bash
npm run db:up --prefix "../Viver Mais Educacional"
npm run db:migrate --prefix "../Viver Mais Educacional"
npm run db:status --prefix "../Viver Mais Educacional"
npm test --prefix "../Viver Mais Educacional" -- src/server/database
```

Expected: migrations aplicam uma vez, a segunda execução não altera o esquema e todos os testes passam.

- [x] **Step 6: Commit**

```bash
git -C "../Viver Mais Educacional" add infra/mysql scripts/migrate.mjs src/server/database package.json package-lock.json README.md
git -C "../Viver Mais Educacional" commit -m "feat: add isolated educational database"
```

### Task 3: Implementar gestores e sessões acadêmicas próprias

**Files:**
- Create: `../Viver Mais Educacional/src/server/security/passwordHash.ts`
- Create: `../Viver Mais Educacional/src/server/auth/managerTypes.ts`
- Create: `../Viver Mais Educacional/src/server/auth/managerRepository.ts`
- Create: `../Viver Mais Educacional/src/server/auth/managerSession.ts`
- Create: `../Viver Mais Educacional/src/server/auth/managerAuth.ts`
- Create: `../Viver Mais Educacional/src/server/auth/managerAuth.test.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/auth/login/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/auth/logout/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/auth/me/route.ts`
- Create: `../Viver Mais Educacional/src/app/academico/login/page.tsx`
- Create: `../Viver Mais Educacional/src/components/management/ManagerLoginForm.tsx`
- Create: `../Viver Mais Educacional/scripts/create-manager.mjs`
- Create: `../Viver Mais Educacional/scripts/create-manager.test.ts`

**Interfaces:**
- Consumes: `getMysqlPool()`, `educationInstitutionId()` e `EDUCATION_MANAGER_SESSION_SECRET`.
- Produces: `MANAGER_SESSION_COOKIE = 'viver_mais_education_manager_session'`, `authenticateManager(email, password): Promise<AcademicManager | null>`, `requireManager(): Promise<ManagerSession>` e `createManagerFromStdin()`.

- [ ] **Step 1: Escrever testes de autenticação e isolamento que falham**

Cobrir: e-mail normalizado; hash `scrypt`; gestor desativado; sessão expirada; revogação após troca de senha; cookie diferente de `viver_mais_session` e `viver_mais_student_session`; ausência de credencial demo; senha nunca recebida por argumento do CLI.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/server/auth scripts/create-manager.test.ts`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Implementar repositório, hash, sessão e APIs**

Usar o formato existente `scrypt$<salt>$<hash>`, HMAC SHA-256, TTL de oito horas, cookies `HttpOnly`, `SameSite=Lax`, `Secure` em produção e caminho `/`. Apenas `role: 'admin'` pode acessar a gestão.

- [ ] **Step 4: Implementar criação segura do primeiro gestor**

O comando deve receber nome e e-mail por prompts ou variáveis explícitas e ler a senha de `stdin` sem eco; deve recusar senha fraca e e-mail duplicado. Não gravar senha, hash ou `DATABASE_URL` em logs.

- [ ] **Step 5: Executar testes e quality gates**

Run: `npm run check --prefix "../Viver Mais Educacional"`

Expected: todos os testes passam e o build inclui `/academico/login` e as três APIs de sessão.

- [ ] **Step 6: Commit**

```bash
git -C "../Viver Mais Educacional" add src/server/security src/server/auth src/app/academico/login src/app/api/academico/gestao/auth src/components/management scripts package.json
git -C "../Viver Mais Educacional" commit -m "feat: add independent academic managers"
```

### Task 4: Portar domínio, persistência e renderização de certificados

**Files:**
- Create: `../Viver Mais Educacional/src/domain/certificates/types.ts`
- Create: `../Viver Mais Educacional/src/domain/certificates/layout.ts`
- Create: `../Viver Mais Educacional/src/domain/certificates/text.ts`
- Create: `../Viver Mais Educacional/src/domain/certificates/sanitize.ts`
- Create: `../Viver Mais Educacional/src/domain/certificates/index.ts`
- Create: `../Viver Mais Educacional/src/domain/certificates/certificates.test.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificateRepository.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificateReadRepository.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificateWriteRepository.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificateTemplateRepository.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificateAssets.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificatePdfLayout.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificateRepository.test.ts`
- Create: `../Viver Mais Educacional/src/server/certificates/certificatePdfLayout.test.ts`

**Interfaces:**
- Consumes: `getMysqlPool()` e `educationInstitutionId()`.
- Produces: `CertificateRecord`, `CertificateTemplate`, `getCertificateRepository(): CertificateRepository`, `certificatePublicValidationUrl(): 'https://vivermaispsicologia.com.br/validarcertificados'` e `renderCertificatePdf(record, template): Promise<Buffer>`. `CertificateRepository` expõe `findByCode(code)`, `list(filter)`, `listForStudent(studentId, institutionId)`, `findForStudentCourse(studentId, courseId, institutionId)`, `issue(input)`, `issueAutomatic(input)`, `updateStatus(code, status, reason, actorId)`, `getTemplate(courseId)` e `saveTemplate(template)`.

- [ ] **Step 1: Copiar os testes de domínio e persistência antes da implementação**

Adaptar os testes existentes de `packages/core/src/certificados` e `apps/web/src/server/certificados`. Acrescentar asserções para URL permanente, código único, get-or-create por aluno/curso, status revogado e ausência de fallback em memória.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/domain/certificates src/server/certificates`

Expected: FAIL por implementações ausentes.

- [ ] **Step 3: Portar e dividir o domínio puro**

Preservar constantes, modelos `standard` e `online-course-with-instructor`, sanitização, texto dos quatro cursos especiais e layout da marca. Dividir por responsabilidade para manter cada arquivo abaixo de 250 linhas.

- [ ] **Step 4: Portar e dividir o repositório MySQL**

Manter uma fachada `CertificateRepository`; separar leituras, escritas e templates. Todas as consultas de aluno devem exigir `institutionId`; `emitAutomatic` deve ser idempotente pelo índice único e nenhum método pode cair para armazenamento em memória.

- [ ] **Step 5: Portar assets e PDF sem dependência clínica**

Copiar somente fontes, logo e recursos necessários ao certificado educacional. Substituir imports de componentes de declaração clínica por um QR dedicado ao educacional.

- [ ] **Step 6: Executar testes e build**

Run: `npm run check --prefix "../Viver Mais Educacional"`

Expected: domínio, persistência e PDF passam; nenhum arquivo de produção excede 250 linhas.

- [ ] **Step 7: Commit**

```bash
git -C "../Viver Mais Educacional" add src/domain/certificates src/server/certificates
git -C "../Viver Mais Educacional" commit -m "feat: port educational certificates"
```

### Task 5: Portar domínio e serviços acadêmicos

**Files:**
- Create: `../Viver Mais Educacional/src/domain/academic/types.ts`
- Create: `../Viver Mais Educacional/src/domain/academic/rules.ts`
- Create: `../Viver Mais Educacional/src/domain/academic/index.ts`
- Create: `../Viver Mais Educacional/src/domain/academic/academic.test.ts`
- Create: `../Viver Mais Educacional/src/server/academic/academicRepository.ts`
- Create: `../Viver Mais Educacional/src/server/academic/studentRepository.ts`
- Create: `../Viver Mais Educacional/src/server/academic/courseRepository.ts`
- Create: `../Viver Mais Educacional/src/server/academic/progressRepository.ts`
- Create: `../Viver Mais Educacional/src/server/academic/mysqlAcademicRepository.ts`
- Create: `../Viver Mais Educacional/src/server/academic/academicManagementService.ts`
- Create: `../Viver Mais Educacional/src/server/academic/studentPortalService.ts`
- Create: `../Viver Mais Educacional/src/server/academic/academicErrors.ts`
- Create: `../Viver Mais Educacional/src/server/academic/academicJourney.test.ts`
- Create: `../Viver Mais Educacional/src/server/academic/mysqlAcademicRepository.test.ts`
- Create: `../Viver Mais Educacional/src/server/http/applicationError.ts`

**Interfaces:**
- Consumes: tipos de certificados, `CertificateRepository`, `getMysqlPool()` e `educationInstitutionId()`.
- Produces: os tipos `AcademicStudent`, `AcademicCourse`, `AcademicModule`, `AcademicLesson`, `AcademicEnrollment`, `LessonCompletion`; `AcademicRepository`; `AcademicManagementService`; `StudentPortalService`; `isCourseCertificateEligible()` e `summarizeCourseProgress()`.

- [ ] **Step 1: Copiar testes acadêmicos e fixar a paridade**

Portar testes de regras, parsing Vimeo, senha, jornada, isolamento de instituição, matrícula ativa, aulas publicadas, progresso e emissão automática. Manter os nomes e formatos públicos dos tipos atuais.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/domain/academic src/server/academic`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Portar o domínio sem `@thats-life/core`**

Mover regras puras para `src/domain`; imports acadêmicos devem apontar apenas para `src/domain/academic` e `src/domain/certificates`.

- [ ] **Step 4: Dividir e portar a persistência**

`MysqlAcademicRepository` continua implementando `AcademicRepository`, mas delega consultas a `studentRepository`, `courseRepository` e `progressRepository`. Todas recebem `Pool` e `institutionId` explicitamente; nenhum singleton de teste pode escapar para produção.

- [ ] **Step 5: Portar os serviços e integrar certificado por porta**

Preservar assinaturas de entradas existentes. `StudentPortalService` recebe `AcademicRepository` e `CertificateRepository`; falha ao emitir certificado não desfaz conclusão, e nova listagem tenta emissão idempotente novamente.

- [ ] **Step 6: Executar testes e quality gates**

Run: `npm run check --prefix "../Viver Mais Educacional"`

Expected: testes acadêmicos passam, build passa e o teste de fronteira não encontra imports clínicos.

- [ ] **Step 7: Commit**

```bash
git -C "../Viver Mais Educacional" add src/domain/academic src/server/academic src/server/http
git -C "../Viver Mais Educacional" commit -m "feat: port academic domain and services"
```

### Task 6: Portar a gestão acadêmica e o painel de certificados

**Files:**
- Create: `../Viver Mais Educacional/src/app/academico/page.tsx`
- Create: `../Viver Mais Educacional/src/app/academico/layout.tsx`
- Create: `../Viver Mais Educacional/src/app/painel-certificados/page.tsx`
- Create: `../Viver Mais Educacional/src/app/painel-certificados/novo/page.tsx`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/alunos/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/alunos/[id]/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/alunos/[id]/senha/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/cursos/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/cursos/[id]/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/cursos/[id]/modulos/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/modulos/[id]/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/modulos/[id]/aulas/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/aulas/[id]/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/matriculas/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/matriculas/[id]/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/certificados/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/certificados/[codigo]/status/route.ts`
- Create: `../Viver Mais Educacional/src/components/academic/management/AcademicManagement.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/ConfirmButton.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/CourseEditor.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/CoursesPanel.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/EnrollmentsPanel.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/LessonEditor.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/ModuleEditor.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/StudentForm.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/StudentsPanel.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/management/managementRequest.ts`
- Create: `../Viver Mais Educacional/src/components/certificates/admin/CertificatesList.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/editor/CertificateCreateWorkspace.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/editor/CertificateMetadataForm.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/editor/CertificateArtworkForm.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/editor/CertificatePreview.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/shared/CertificateQrCode.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/shared/CertificateStampContent.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/shared/FrontQrSettingsCard.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/shared/StampSettingsCard.tsx`
- Create: `../Viver Mais Educacional/src/server/academic/managementApi.ts`
- Create: `../Viver Mais Educacional/src/components/academic/management/AcademicManagement.test.tsx`
- Create: `../Viver Mais Educacional/src/app/api/academico/gestao/route.test.ts`
- Create: `../Viver Mais Educacional/src/app/painel-certificados/panel.test.tsx`

**Interfaces:**
- Consumes: `requireManager()`, `AcademicManagementService`, `CertificateRepository` e componentes de certificado da Task 4.
- Produces: gestão em `/academico`, geração preservada em `/painel-certificados` e `/painel-certificados/novo`, mais APIs protegidas de gestão e certificados.

- [ ] **Step 1: Portar testes de gestão e adicionar as URLs permanentes**

Cobrir que gestor ausente recebe 401/redirect, gestor válido administra alunos/cursos/matrículas, `/painel-certificados` renderiza a lista e `/painel-certificados/novo` renderiza o editor sem alterar o pathname.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/components/academic/management src/app/api/academico/gestao src/app/painel-certificados`

Expected: FAIL por páginas e rotas ausentes.

- [ ] **Step 3: Portar rotas e substituir autorização clínica**

Trocar `exigirGestao()` e `readSession()` por `requireManager()`. Preservar envelopes HTTP, mensagens, status e contratos consumidos pelos componentes atuais. Manter `CERTIFICADOS_ADMIN_PIN` como segunda proteção do painel durante a primeira extração, mas enviá-lo em header privado ou corpo — nunca em query string ou log. Removê-lo ou redesenhar esse acesso fica fora do escopo.

- [ ] **Step 4: Portar a interface acadêmica sem redesign**

Copiar estilos e markup dos componentes atuais. Atualizar somente imports e endpoint de login. Não incorporar o shell clínico nem links para prontuários, agenda ou financeiro.

- [ ] **Step 5: Dividir o editor e a lista de certificados**

Manter estado/orquestração em `CertificateCreateWorkspace`; mover formulário, arte e preview para componentes focados. Preservar campos, coordenadas, preview, upload, QR, carimbo e textos existentes.

- [ ] **Step 6: Executar testes, lint, tipos e build**

Run: `npm run check --prefix "../Viver Mais Educacional"`

Expected: gestão e painel passam, as duas URLs antigas aparecem no manifesto do build e nenhum componente ultrapassa 250 linhas.

- [ ] **Step 7: Commit**

```bash
git -C "../Viver Mais Educacional" add src/app/academico src/app/painel-certificados src/app/api/academico/gestao src/app/api/certificados src/components/academic/management src/components/certificates src/server/academic/managementApi.ts
git -C "../Viver Mais Educacional" commit -m "feat: port academic management and certificate panel"
```

### Task 7: Portar portal do aluno e validação pública

**Files:**
- Create: `../Viver Mais Educacional/src/server/auth/studentSession.ts`
- Create: `../Viver Mais Educacional/src/server/auth/studentAuth.ts`
- Create: `../Viver Mais Educacional/src/server/auth/studentAuth.test.ts`
- Create: `../Viver Mais Educacional/src/app/aluno/layout.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/page.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/login/page.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/cursos/page.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/cursos/[cursoId]/page.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/aulas/[aulaId]/page.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/certificados/page.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/minha-conta/page.tsx`
- Create: `../Viver Mais Educacional/src/app/aluno/trocar-senha/page.tsx`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/inicio/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/perfil/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/cursos/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/cursos/[id]/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/aulas/[id]/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/aulas/[id]/concluir/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/certificados/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/certificados/[codigo]/pdf/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/auth/login/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/auth/logout/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/auth/me/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/academico/auth/trocar-senha/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/public/certificados/[codigo]/pdf/route.ts`
- Create: `../Viver Mais Educacional/src/app/api/public/certificados/validar/[codigo]/route.ts`
- Create: `../Viver Mais Educacional/src/app/validar-certificado/page.tsx`
- Create: `../Viver Mais Educacional/src/app/validar-certificado/[codigo]/page.tsx`
- Create: `../Viver Mais Educacional/src/app/validarcertificados/page.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/CourseDetail.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/CourseGrid.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/ForcePasswordChange.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/StudentAccount.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/StudentCertificates.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/StudentDashboard.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/StudentLoginForm.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/StudentShell.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/VimeoLessonPlayer.tsx`
- Create: `../Viver Mais Educacional/src/components/academic/student/vimeoPlayer.ts`
- Create: `../Viver Mais Educacional/src/components/certificates/public/PublicCertificateValidation.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/public/CertificateDocumentView.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/public/CertificateActions.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/public/CertificateFront.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/public/CertificateBack.tsx`
- Create: `../Viver Mais Educacional/src/components/certificates/public/CertificateBrandLayout.tsx`
- Create: `../Viver Mais Educacional/src/app/api/academico/aluno/route.test.ts`
- Create: `../Viver Mais Educacional/src/app/api/public/certificados/publicCertificates.test.ts`
- Create: `../Viver Mais Educacional/src/components/academic/student/studentViews.test.tsx`

**Interfaces:**
- Consumes: `StudentPortalService`, `CertificateRepository`, `renderCertificatePdf()` e `AUTH_STUDENT_SESSION_SECRET`.
- Produces: `STUDENT_SESSION_COOKIE = 'viver_mais_student_session'`, portal completo `/aluno`, APIs autenticadas e validação pública permanente.

- [ ] **Step 1: Portar testes do aluno e escrever os casos críticos de validação**

Além dos testes atuais, cobrir: cookie do aluno diferente do gestor; aluno A não lista nem baixa certificado do aluno B; banco indisponível retorna 503 `SERVICE_UNAVAILABLE`; código inexistente retorna 404 `NOT_FOUND`; revogado permanece resposta válida com status `revoked`; `/validarcertificados` usa a mesma tela pública.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/server/auth/studentAuth.test.ts src/app/api/academico/aluno src/app/api/public/certificados src/components/academic/student`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Portar sessão, autenticação e APIs do aluno**

Preservar troca obrigatória, revogação por `passwordChangedAt`, matrícula ativa e autorização derivada da sessão. Usar segredo exclusivo do aluno e nunca aceitar `studentId` do navegador como autoridade.

- [ ] **Step 4: Portar telas e player Vimeo sem redesign**

Copiar shell, dashboard, cursos, aula, conta, certificados e estados de erro/vazio. Preservar parsing de vídeos privados e um único listener `ended` por player.

- [ ] **Step 5: Portar validação e PDF públicos**

Manter `/validarcertificados`, `/validar-certificado`, `/validar-certificado/[codigo]` e as APIs públicas. Mapear indisponibilidade de persistência para 503 sem devolver falso “inválido”. Dividir o visualizador atual entre ações, frente, verso e layout da marca, mantendo o documento final idêntico e cada componente abaixo de 250 linhas.

- [ ] **Step 6: Executar a suíte completa**

Run: `npm run check --prefix "../Viver Mais Educacional"`

Expected: portal, validação, PDFs, cookies e build passam.

- [ ] **Step 7: Commit**

```bash
git -C "../Viver Mais Educacional" add src/server/auth/student* src/app/aluno src/app/api/academico/aluno src/app/api/academico/auth src/app/api/public/certificados src/app/validar-certificado src/app/validarcertificados src/components/academic/student src/components/certificates/public
git -C "../Viver Mais Educacional" commit -m "feat: port student portal and public validation"
```

### Task 8: Criar cópia e reconciliação idempotentes dos dados

**Files:**
- Create: `../Viver Mais Educacional/src/migration/academicTableManifest.ts`
- Create: `../Viver Mais Educacional/src/migration/copyAcademicData.ts`
- Create: `../Viver Mais Educacional/src/migration/reconcileAcademicData.ts`
- Create: `../Viver Mais Educacional/src/migration/migrationTypes.ts`
- Create: `../Viver Mais Educacional/src/migration/copyAcademicData.test.ts`
- Create: `../Viver Mais Educacional/src/migration/reconcileAcademicData.test.ts`
- Create: `../Viver Mais Educacional/scripts/copy-academic-data.ts`
- Create: `../Viver Mais Educacional/scripts/reconcile-academic-data.ts`
- Modify: `../Viver Mais Educacional/package.json`
- Modify: `../Viver Mais Educacional/README.md`

**Interfaces:**
- Consumes: `CLINIC_SOURCE_DATABASE_URL` e `EDUCATION_DESTINATION_DATABASE_URL`, somente nos comandos administrativos.
- Produces: `copyAcademicData(options: CopyOptions): Promise<CopyReport>` e `reconcileAcademicData(options: ReconcileOptions): Promise<ReconcileReport>`; `CopyOptions.direction` aceita `clinic-to-education` ou `education-to-clinic`, e a direção reversa exige `confirmReverse: true`.

- [ ] **Step 1: Escrever testes do manifesto e da idempotência**

Fixar a ordem: `instituicoes`, `clinica_cursos_pos_graduacao`, `clinica_alunos`, `clinica_cursos_modulos`, `clinica_cursos_aulas`, `clinica_aluno_matriculas`, `clinica_aluno_progresso_aulas`, `clinica_certificados`, `clinica_certificados_templates`. Testar duas cópias consecutivas, delta atualizado, preservação de código/ID, campos LONGTEXT, recusa da direção reversa sem confirmação e logs sem CPF/senha/hash.

- [ ] **Step 2: Executar os testes e confirmar a falha**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/migration`

Expected: FAIL por módulos ausentes.

- [ ] **Step 3: Implementar cópia em lotes e transações por tabela**

Usar chaves primárias explícitas e upsert com a origem como autoridade apenas nos modos `initial` e `delta`, antes da abertura do destino. Nunca executar DDL com credenciais de dados; nunca imprimir linhas copiadas.

- [ ] **Step 4: Implementar reconciliação por contagem e hash canônico**

Para cada tabela, comparar contagem, conjunto de chaves e SHA-256 de JSON canônico ordenado pela chave primária. O relatório deve listar tabela e tipo da divergência sem exibir valores pessoais.

- [ ] **Step 5: Testar com dois bancos locais reais**

Run:

```bash
npm run db:migrate --prefix "../Viver Mais Educacional"
npm run data:copy --prefix "../Viver Mais Educacional" -- --mode=initial --direction=clinic-to-education
npm run data:copy --prefix "../Viver Mais Educacional" -- --mode=delta --direction=clinic-to-education
npm run data:reconcile --prefix "../Viver Mais Educacional"
```

Expected: segunda cópia não aumenta contagens e reconciliação termina com `matched: true`.

- [ ] **Step 6: Executar quality gates e commit**

Run: `npm run check --prefix "../Viver Mais Educacional"`

```bash
git -C "../Viver Mais Educacional" add src/migration scripts package.json package-lock.json README.md
git -C "../Viver Mais Educacional" commit -m "feat: add academic data migration tools"
```

### Task 9: Preparar deploy sombra e comprovar paridade

**Files:**
- Modify: `../Viver Mais Educacional/next.config.mjs`
- Modify: `../Viver Mais Educacional/src/app/layout.tsx`
- Modify: `../Viver Mais Educacional/src/app/globals.css`
- Create: `../Viver Mais Educacional/src/assets/logo-viver-mais.png`
- Create: `../Viver Mais Educacional/src/assets/logo-viver-mais-white.png`
- Create: `../Viver Mais Educacional/src/config/publicOrigin.ts`
- Create: `../Viver Mais Educacional/src/config/publicOrigin.test.ts`
- Create: `../Viver Mais Educacional/scripts/smoke.mjs`
- Create: `../Viver Mais Educacional/scripts/compare-certificate-pdf.mjs`
- Create: `../Viver Mais Educacional/docs/operations/shadow-validation.md`
- Modify: `../Viver Mais Educacional/package.json`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_APP_URL`, `EDUCATION_ASSET_PREFIX`, `SMOKE_ORIGIN`, `SMOKE_MANAGER_EMAIL`, `SMOKE_MANAGER_PASSWORD`, `SMOKE_STUDENT_EMAIL`, `SMOKE_STUDENT_PASSWORD`.
- Produces: assets sob o prefixo exclusivo `/_educacional-assets`, `publicAppUrl(): string`, `npm run smoke` e `npm run compare:certificate`.

- [ ] **Step 1: Escrever testes de URL e assets que falham**

Testar remoção de barra final, rejeição de HTTP em produção, URL pública `clinicavivermais.cloud`, URL de validação imutável e ausência de referências de browser a `/logo-*` ou outros assets públicos sem prefixo/import estático.

- [ ] **Step 2: Executar o teste e confirmar a falha**

Run: `npm test --prefix "../Viver Mais Educacional" -- src/config/publicOrigin.test.ts`

Expected: FAIL por configuração ausente.

- [ ] **Step 3: Configurar origem, prefixo e identidade visual**

Usar `/_educacional-assets` como prefixo externo; a clínica removerá esse prefixo ao encaminhar para `/_next/static` do deploy educacional. O próprio deploy educacional também terá rewrite local de `/_educacional-assets/:path*` para `/:path*`, permitindo validar a origem técnica com o mesmo build. Importar imagens usadas no browser pelo bundler. Copiar CSS, fontes e tokens visuais atuais sem redesign.

- [ ] **Step 4: Implementar smoke test sem segredos na linha de comando**

O script deve ler credenciais somente do ambiente, verificar login de gestor e aluno, curso, aula, painel, certificado, validação e PDF; mensagens de falha não podem imprimir credenciais ou cookies.

- [ ] **Step 5: Implementar comparação de certificado**

Comparar texto extraído, quantidade/tamanho de páginas e imagens renderizadas com tolerância documentada para metadados invisíveis. Usar um certificado legado, um padrão automático e um `online-course-with-instructor`.

- [ ] **Step 6: Publicar a origem técnica e executar paridade**

Run:

```bash
npm run check --prefix "../Viver Mais Educacional"
npm run smoke --prefix "../Viver Mais Educacional"
npm run compare:certificate --prefix "../Viver Mais Educacional"
```

Expected: todas as jornadas passam na origem técnica e o relatório de PDF não mostra diferença visual relevante.

- [ ] **Step 7: Commit**

```bash
git -C "../Viver Mais Educacional" add next.config.mjs src/app src/assets src/config scripts docs package.json package-lock.json
git -C "../Viver Mais Educacional" commit -m "chore: prepare shadow deployment"
```

### Task 10: Implementar o roteador de virada na aplicação clínica

**Files:**
- Create: `apps/web/src/server/routing/educationCutover.ts`
- Create: `apps/web/src/server/routing/educationCutover.test.ts`
- Modify: `apps/web/src/proxy.ts`
- Modify: `apps/web/next.config.mjs`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`
- Create: `apps/web/src/app/academico-indisponivel/page.tsx`
- Create: `apps/web/src/app/academico-indisponivel/page.test.tsx`
- Modify: `docs/vercel-setup-guia.md`
- Modify: `docs/hostinger-vps.md`

**Interfaces:**
- Consumes: `ACADEMIC_CUTOVER_STATE = 'legacy' | 'maintenance' | 'education'` e `EDUCATION_ORIGIN`, obrigatório e HTTPS no estado `education`.
- Produces: `resolveEducationRoute(input: EducationRouteInput): EducationRouteDecision`, com decisões `next`, `rewrite`, `redirect` ou `maintenance`.

- [ ] **Step 1: Escrever a matriz de roteamento que falha**

Cobrir os três estados e os caminhos `/aluno/**`, `/academico/**`, `/gestao/academico`, `/painel-certificados/**`, `/validarcertificados`, `/validar-certificado/**`, `/api/academico/**`, `/api/certificados/**`, `/api/public/certificados/**` e `/_educacional-assets/**`. Confirmar que `/pacientes`, `/agenda`, `/api/application/**` e `/_next/**` nunca são encaminhados ao educacional.

- [ ] **Step 2: Adicionar os casos de URL permanente e assets**

Asserir que `/painel-certificados` e `/painel-certificados/novo` recebem `rewrite`, não `redirect`; `/validarcertificados` mantém o pathname; `/_educacional-assets/_next/static/x.js` é reescrito para `<EDUCATION_ORIGIN>/_next/static/x.js`; `/gestao/academico` é o único redirect de compatibilidade para `/academico`.

- [ ] **Step 3: Executar os testes e confirmar a falha**

Run: `npm run test --workspace @thats-life/web -- src/server/routing/educationCutover.test.ts`

Expected: FAIL por roteador ausente.

- [ ] **Step 4: Implementar a função pura e integrá-la ao proxy**

No estado `legacy`, preservar o comportamento atual. Em `maintenance`, manter validação pública legada disponível e bloquear páginas protegidas e mutações acadêmicas com 503. Em `education`, executar as decisões antes da lista `persistentApi`, para que APIs educacionais não sejam enviadas ao backend clínico.

- [ ] **Step 5: Ajustar rewrites e navegação sem regra global**

Manter durante os 30 dias os rewrites legados de certificados necessários ao estado `legacy`; o proxy educacional deve ter precedência no estado `education`. Atualizar o item “Área de Alunos” para `/academico`. Validar `EDUCATION_ORIGIN` com HTTPS e sem barra final.

- [ ] **Step 6: Executar regressão clínica**

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run web:build
```

Expected: matriz de roteamento e toda a suíte clínica passam; não existe rewrite `/:path*`.

- [ ] **Step 7: Commit no repositório clínico**

```bash
git add apps/web/src/server/routing apps/web/src/proxy.ts apps/web/next.config.mjs apps/web/src/components/layout/Sidebar.tsx apps/web/src/app/academico-indisponivel docs/vercel-setup-guia.md docs/hostinger-vps.md
git commit -m "feat: route academic traffic to educational platform"
```

### Task 11: Ensaiar e executar a virada controlada

**Files:**
- Create: `docs/operations/extracao-educacional-cutover.md`
- Create: `../Viver Mais Educacional/docs/operations/cutover-checklist.md`
- Create: `../Viver Mais Educacional/docs/operations/rollback-checklist.md`

**Interfaces:**
- Consumes: backups verificados, origem técnica aprovada, comandos das Tasks 8–10 e acesso aos dois projetos de deploy.
- Produces: registro de ensaio, checklist assinado, relatórios de reconciliação, smoke de produção e ponto de rollback documentado.

- [ ] **Step 1: Escrever o runbook antes de tocar produção**

Fixar ordem e responsável para: backup; cópia inicial; reconciliação; deploy `legacy`; estado `maintenance`; delta final; segunda reconciliação; estado `education`; smoke; monitoramento; rollback. Não incluir segredos no documento.

- [ ] **Step 2: Ensaiar com cópias locais dos dois bancos**

Simular uma escrita depois da cópia inicial, executar delta e provar que a reconciliação volta a `matched: true`. Depois simular uma escrita no destino, executar rollback com direção reversa e `confirmReverse: true` e provar equivalência novamente.

- [ ] **Step 3: Verificar isolamento MySQL**

Conectar com a credencial da aplicação educacional e provar: CRUD permitido nas tabelas educacionais; `SELECT` e `SHOW` do banco clínico recusados. Anexar somente resultados sanitizados ao runbook.

- [ ] **Step 4: Revisar backups, origem técnica e janela de manutenção**

STOP: obter aprovação explícita do operador antes de mudar `ACADEMIC_CUTOVER_STATE` ou copiar produção. Confirmar duração da janela e canal de aviso aos alunos/gestores.

- [ ] **Step 5: Executar cópia inicial e reconciliação em produção**

Run: `npm run data:copy -- --mode=initial --direction=clinic-to-education`, seguido de `npm run data:reconcile` no ambiente administrativo seguro.

Expected: `matched: true`; nenhuma rota pública ainda aponta ao novo banco.

- [ ] **Step 6: Executar manutenção, delta e virada**

Alterar para `maintenance`, aguardar requisições acadêmicas em curso, copiar delta, reconciliar, alterar para `education` e executar deploys. Se a reconciliação não for exata, não abrir o destino.

- [ ] **Step 7: Executar smoke e monitoramento pós-virada**

Verificar as duas URLs permanentes, login dos dois perfis, aula, conclusão, emissão, PDF e rotas clínicas. Monitorar erros 5xx, falhas MySQL e emissão por pelo menos uma janela operacional combinada.

- [ ] **Step 8: Commit dos runbooks e evidências sanitizadas**

```bash
git add docs/operations/extracao-educacional-cutover.md
git commit -m "docs: add educational cutover runbook"
git -C "../Viver Mais Educacional" add docs/operations
git -C "../Viver Mais Educacional" commit -m "docs: record educational cutover"
```

### Task 12: Remover o legado depois da retenção de 30 dias

**Files:**
- Delete directory: `apps/web/src/app/aluno`
- Delete directory: `apps/web/src/app/api/academico`
- Delete directory: `apps/web/src/app/api/certificados`
- Delete directory: `apps/web/src/app/api/public/certificados`
- Delete directory: `apps/web/src/app/gestao/academico`
- Delete directory: `apps/web/src/app/painel-certificados`
- Delete directory: `apps/web/src/app/validar-certificado`
- Delete directory: `apps/web/src/app/validarcertificados`
- Delete directory: `apps/web/src/components/academic`
- Delete directory: `apps/web/src/components/certificados`
- Delete directory: `apps/web/src/server/academic`
- Delete directory: `apps/web/src/server/certificados`
- Delete directory: `packages/core/src/academic`
- Delete directory: `packages/core/src/certificados`
- Delete: `infra/mysql/018_catalogo_pos_graduacoes.sql`
- Delete: `infra/mysql/030_certificados.sql`
- Delete: `infra/mysql/032_remover_certificados_demonstracao.sql`
- Delete: `infra/mysql/048_certificados_carimbo_livre.sql`
- Delete: `infra/mysql/049_certificados_qr_frente.sql`
- Delete: `infra/mysql/053_portal_aluno.sql`
- Delete: `infra/mysql/054_portal_aluno_sessao_vimeo.sql`
- Delete: `infra/mysql/055_catalogo_cursos_assinante.sql`
- Delete: `infra/mysql/056_certificados_portal_aluno.sql`
- Delete: `infra/mysql/057_certificado_modelo_cursos_especiais.sql`
- Modify: `apps/web/src/server/application/termoAdesaoComprovantePdf.ts`
- Create: `apps/web/src/server/documents/documentAssets.ts`
- Create: `apps/web/src/architecture-boundaries.test.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `apps/web/src/components/layout/LayoutShell.tsx`
- Modify: `apps/web/src/proxy.ts`
- Modify: `apps/web/next.config.mjs`
- Create: `docs/operations/remocao-legado-educacional.md`

**Interfaces:**
- Consumes: 30 dias concluídos, métricas estáveis, backup restaurável e aprovação destrutiva específica.
- Produces: clínica sem código acadêmico local; roteamento permanente continua no proxy; helper clínico de assets continua servindo termo de adesão.

- [ ] **Step 1: Criar testes de ausência do legado antes da remoção**

Adicionar teste arquitetural clínico que recusa imports `server/academic`, `components/academic`, `server/certificados/certificadosRepository` e exports acadêmicos/certificados no core, mas permite `fiscal/certificadoIcpBrasil` e `documents/documentAssets`.

- [ ] **Step 2: Confirmar que o teste falha com o legado presente**

Run: `npm run test --workspace @thats-life/web -- src/server/routing/educationCutover.test.ts src/architecture-boundaries.test.ts`

Expected: FAIL listando somente os módulos que serão removidos.

- [ ] **Step 3: Desacoplar assets usados pelo termo de adesão**

Mover somente os recursos genéricos necessários para `documentAssets.ts`, atualizar `termoAdesaoComprovantePdf.ts` e provar por teste que o comprovante clínico continua renderizando.

- [ ] **Step 4: Remover código, rotas e exports acadêmicos locais**

Manter no proxy todas as rotas permanentes apontando ao educacional. Manter certificados ICP-Brasil, NFS-e, declarações, turmas e campos de pós-graduação clínica.

- [ ] **Step 5: Verificar instalação clínica do zero sem migrations acadêmicas**

Construir banco clínico vazio com o conjunto final de migrations. Não editar checksums de migrations já aplicadas; documentar a retirada dos arquivos acadêmicos e provar que migrations posteriores não dependem deles.

- [ ] **Step 6: Executar a regressão completa dos dois repositórios**

Run:

```bash
npm run check
npm run check --prefix "../Viver Mais Educacional"
```

Expected: os dois projetos passam e as URLs permanentes continuam respondendo pelo projeto educacional.

- [ ] **Step 7: Commit da remoção de código**

```bash
git add -A apps/web packages/core infra/mysql docs/operations/remocao-legado-educacional.md
git commit -m "refactor: remove migrated educational modules"
```

- [ ] **Step 8: Remover tabelas antigas somente após nova aprovação**

STOP: validar novamente backup, contagens e ausência de leituras por 30 dias. Solicitar aprovação destrutiva indicando a lista exata de tabelas; executar `DROP TABLE` em ordem reversa de chaves somente depois dessa aprovação e registrar o resultado sanitizado no runbook.

## Verificação final

- [ ] `git status --short` está limpo nos dois repositórios, exceto por mudanças preexistentes e explicitamente preservadas.
- [ ] `npm run check` passa em `Clinica Viver Mais`.
- [ ] `npm run check --prefix "../Viver Mais Educacional"` passa.
- [ ] O deploy educacional pode ser feito sem reconstruir a clínica e vice-versa.
- [ ] O banco educacional é a única fonte de verdade acadêmica.
- [ ] A credencial educacional não acessa o banco clínico.
- [ ] `/painel-certificados` e `/painel-certificados/novo` mantêm URL, aparência e comportamento.
- [ ] `vivermaispsicologia.com.br/validarcertificados` valida certificados antigos e novos.
- [ ] Não existe rewrite global e rotas clínicas não atravessam o deploy educacional.
- [ ] O rollback ensaiado e os backups permanecem disponíveis durante a retenção.

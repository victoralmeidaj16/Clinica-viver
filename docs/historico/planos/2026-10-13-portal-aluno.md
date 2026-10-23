# Portal do Aluno Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um portal acadêmico independente no qual a gestão administra alunos, matrículas e conteúdo Vimeo, e cada aluno acompanha cursos, aulas e progresso com uma conta separada.

**Architecture:** Um contexto acadêmico isolado usa tabelas MySQL próprias, serviços de aplicação e uma sessão acadêmica separada da sessão clínica. O catálogo existente de pós-graduações é ampliado, enquanto módulos, aulas, matrículas e progresso ganham repositórios próprios; interfaces administrativas e do aluno consomem APIs com autoridades distintas.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, MySQL 8, Tailwind CSS 3, Vitest 4, Vimeo Player API, Lucide React.

**Spec:** `docs/superpowers/specs/2026-10-13-portal-aluno-design.md`

## Global Constraints

- Contas acadêmicas não usam `clinica_usuarios` nem `clinica_membros`.
- A sessão acadêmica usa cookie próprio e pode coexistir com `viver_mais_session`.
- Senhas temporárias e definitivas exigem ao menos 10 caracteres, incluindo letra e número, e nunca são persistidas ou registradas em texto.
- Somente Vimeo é aceito; entrada administrativa deve resolver para ID numérico.
- O aluno vê apenas cursos com matrícula ativa, curso ativo/publicado e aulas publicadas.
- Conclusão é automática no evento `ended`, idempotente e não é prova antifraude.
- Não implementar calendário, financeiro, certificados, materiais, quizzes, e-mail ou bloqueio sequencial.
- Componentes React novos devem permanecer abaixo de 250 linhas.
- Rotas de API acadêmicas podem ser encaminhadas à VPS; nunca adicionar rewrite global `/:path*`.
- Antes de alterar código Next.js, ler `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md`, `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` e, para páginas dinâmicas, `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`.

## Review Focus

- Mesmo e-mail em conta profissional e acadêmica: ambas devem existir e autenticar apenas em seus logins próprios; coberto nos testes dos Tasks 2 e 4.
- Conta ou matrícula suspensa com cookie antigo: toda API acadêmica deve revalidar o status e negar imediatamente; coberto no Task 4.
- Aula publicada ou despublicada depois de haver progresso: o percentual deve usar somente aulas atualmente publicadas sem apagar conclusões; coberto no Task 1.
- Evento Vimeo `ended` repetido ou reenviado após falha de rede: deve devolver sucesso sem duplicar conclusão; coberto nos Tasks 2 e 4.
- URL Vimeo privada, com caminho extra, ou entrada não Vimeo: aceitar apenas quando houver ID numérico resolvível e rejeitar provedor diferente; coberto no Task 1.

---

### Task 1: Domínio acadêmico puro

**Files:**
- Create: `packages/core/src/academic/types.ts`
- Create: `packages/core/src/academic/rules.ts`
- Create: `packages/core/src/academic/index.ts`
- Create: `packages/core/src/academic/academic.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `AcademicStudent`, `AcademicCourse`, `AcademicModule`, `AcademicLesson`, `AcademicEnrollment`, `LessonCompletion`, `CourseProgress`.
- Produces: `normalizeVimeoId(input: string): string`, `assertAcademicPassword(password: string): void`, `summarizeCourseProgress(lessons: readonly AcademicLesson[], completions: readonly LessonCompletion[]): CourseProgress`, `nextIncompleteLesson(lessons: readonly AcademicLesson[], completions: readonly LessonCompletion[]): AcademicLesson | undefined`.
- `CourseProgress` has `{ completed: number; total: number; percentage: number }`.
- `normalizeVimeoId` accepts a numeric ID or a `vimeo.com`/`player.vimeo.com` URL containing a numeric video ID; it throws for other providers or unresolved input.

- [x] **Step 1: Write failing domain tests**

Add tests named:

```ts
it('normaliza ID e URLs Vimeo, inclusive player e caminho privado')
it('recusa YouTube, texto vazio e URL Vimeo sem ID numérico')
it('exige 10 caracteres com letra e número na senha acadêmica')
it('calcula progresso somente sobre aulas publicadas')
it('preserva conclusão armazenada ao despublicar uma aula sem contá-la no percentual')
it('seleciona a primeira aula publicada e não concluída na ordem módulo/aula')
```

- [x] **Step 2: Run the tests and verify failure**

Run: `npm run test --workspace @thats-life/core -- --run src/academic/academic.test.ts`  
Expected: FAIL because `academic` exports do not exist.

- [x] **Step 3: Implement types and pure rules**

Keep ordering explicit with numeric `position` fields. `summarizeCourseProgress` filters unpublished lessons before calculating the denominator, while completions remain immutable inputs.

- [x] **Step 4: Export the academic module and verify it**

Run: `npm run test --workspace @thats-life/core -- --run src/academic/academic.test.ts && npm run check --workspace @thats-life/core`  
Expected: tests PASS and TypeScript exits 0.

- [x] **Step 5: Commit**

```bash
git add packages/core/src/academic packages/core/src/index.ts
git commit -m "feat(core): adiciona dominio academico"
```

### Task 2: Schema e repositório acadêmico MySQL

**Files:**
- Create: `infra/mysql/053_portal_aluno.sql`
- Create: `apps/web/src/server/academic/academicRepository.ts`
- Create: `apps/web/src/server/academic/mysqlAcademicRepository.ts`
- Create: `apps/web/src/server/academic/mysqlAcademicRepository.test.ts`
- Create: `apps/web/src/server/academic/academicSchema.test.ts`

**Interfaces:**
- Consumes: tipos acadêmicos do Task 1.
- Produces: `StudentCredential { student: AcademicStudent; passwordHash: string }` and `AcademicRepository` with `findStudentCredentialByEmail`, `getStudent`, `listStudents`, `saveStudent`, `listCoursesForManagement`, `getCourseTree`, `saveCourse`, `saveModule`, `saveLesson`, `listEnrollments`, `saveEnrollment`, `listStudentCourses`, `getStudentLesson`, `listCompletions`, and `completeLesson`.
- Produces: `getAcademicRepository(): AcademicRepository`, returning `MysqlAcademicRepository` when MySQL is configured and throwing `PERSISTENCE_UNAVAILABLE` otherwise; there is no production in-memory fallback for real student accounts.
- `completeLesson(studentId: string, lessonId: string, completedAt: string): Promise<void>` is idempotent.

- [x] **Step 1: Write failing schema contract tests**

Read `053_portal_aluno.sql` as text and assert it creates `clinica_alunos`, `clinica_aluno_matriculas`, `clinica_cursos_modulos`, `clinica_cursos_aulas`, and `clinica_aluno_progresso_aulas`; adds course presentation/publication fields to `clinica_cursos_pos_graduacao`; uses tenant foreign keys and unique keys for academic email, enrollment, and completion.

Also assert `clinica_alunos` is independent of `clinica_usuarios`, so the same normalized e-mail may exist in both identity namespaces.

- [x] **Step 2: Run the schema test and verify failure**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/academicSchema.test.ts`  
Expected: FAIL because migration 053 does not exist.

- [x] **Step 3: Add migration 053**

Use `CHAR(36)` identifiers for students/modules/lessons/progress, `BIGINT UNSIGNED` for the existing course PK, `TIMESTAMP(3)`, InnoDB and `utf8mb4_0900_ai_ci`. Add `descricao`, `capa_url`, `ordem`, and `publicado` to the existing course table with idempotent information-schema guards.

- [x] **Step 4: Write failing repository tests with a mocked pool**

Tests must assert:

```ts
it('aplica instituicao_id em toda leitura e escrita')
it('mapeia a árvore curso > módulos > aulas na ordem persistida')
it('lista para o aluno somente matrícula ativa e conteúdo ativo/publicado')
it('usa INSERT IGNORE para tornar a conclusão idempotente')
it('suspende matrícula sem apagar as conclusões')
```

- [x] **Step 5: Run repository tests and verify failure**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/mysqlAcademicRepository.test.ts`  
Expected: FAIL because repository modules do not exist.

- [x] **Step 6: Implement repository port and MySQL adapter**

Inject `Pool` into `MysqlAcademicRepository` for unit tests. Use a transaction for aggregate writes that reorder modules or lessons. Never select `senha_hash` in list/profile projections; expose it only through the credential lookup used by authentication.

- [x] **Step 7: Verify schema and repository tests**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/academicSchema.test.ts src/server/academic/mysqlAcademicRepository.test.ts`  
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add infra/mysql/053_portal_aluno.sql apps/web/src/server/academic
git commit -m "feat(academic): adiciona persistencia do portal"
```

### Task 3: Serviços e APIs da gestão acadêmica

**Files:**
- Create: `apps/web/src/server/academic/academicManagementService.ts`
- Create: `apps/web/src/server/academic/academicManagementService.test.ts`
- Create: `apps/web/src/server/security/passwordHash.ts`
- Create: `apps/web/src/server/security/passwordHash.test.ts`
- Create: `apps/web/src/app/api/academico/gestao/alunos/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/alunos/[id]/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/alunos/[id]/senha/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/cursos/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/cursos/[id]/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/cursos/[id]/modulos/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/modulos/[id]/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/modulos/[id]/aulas/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/aulas/[id]/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/matriculas/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/matriculas/[id]/route.ts`
- Create: `apps/web/src/app/api/academico/gestao/route.test.ts`
- Modify: `apps/web/src/server/auth.ts`

**Interfaces:**
- Consumes: `AcademicRepository`, `assertAcademicPassword`, `normalizeVimeoId`, `hashPassword`, `exigirGestao()`, and `readSession()`.
- Produces: shared `hashPassword(password: string): string` and `verifyPasswordHash(password: string, encodedHash: string): boolean`; `server/auth.ts` re-exports `hashPassword` so current callers stay compatible.
- Produces: `AcademicManagementService` methods `createStudent`, `updateStudent`, `resetTemporaryPassword`, `setStudentStatus`, `createCourse`, `updateCourse`, `createModule`, `updateModule`, `createLesson`, `updateLesson`, `upsertEnrollment`.
- `createStudent(input, actorUserId)` returns a safe student projection and never returns the password/hash.
- Course/module/lesson update inputs carry an explicit `position` and `published` state.

- [x] **Step 1: Write failing password-hash and service tests**

Cover scrypt hash/verify round-trip and malformed hash rejection, then strong temporary password, duplicate academic e-mail, safe response projection, reset setting `mustChangePassword=true`, numeric Vimeo normalization, foreign provider rejection, enrollment upsert/suspension, and administrator attribution.

- [x] **Step 2: Run service tests and verify failure**

Run: `npm run test --workspace @thats-life/web -- --run src/server/security/passwordHash.test.ts src/server/academic/academicManagementService.test.ts`  
Expected: FAIL because the service does not exist.

- [x] **Step 3: Implement the management service**

Extract the current scrypt format from `server/auth.ts` without changing existing hashes. Use `ApplicationError` codes `WEAK_PASSWORD`, `EMAIL_IN_USE`, `INVALID_VIMEO`, `NOT_FOUND`, and `CONFLICT`. Keep parsing/validation out of React components and route handlers.

- [x] **Step 4: Write failing route authorization and envelope tests**

Mock `exigirGestao`, `readSession` and the service. Assert 401/403 propagation, 201 on create, 200 on update/list, safe error messages, actor ID propagation from the active admin session, and that a non-admin request never calls a service method.

- [x] **Step 5: Run route tests and verify failure**

Run: `npm run test --workspace @thats-life/web -- --run src/app/api/academico/gestao/route.test.ts`  
Expected: FAIL because route handlers do not exist.

- [x] **Step 6: Implement thin management route handlers**

Follow the existing `{ ok, data, meta }` / `{ ok, error }` envelope. Keep each handler focused on parsing request data, requiring management authority, calling one service method, and mapping errors.

- [x] **Step 7: Verify management service and API**

Run: `npm run test --workspace @thats-life/web -- --run src/server/security/passwordHash.test.ts src/server/academic/academicManagementService.test.ts src/app/api/academico/gestao/route.test.ts`  
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add apps/web/src/server/academic apps/web/src/server/security apps/web/src/server/auth.ts apps/web/src/app/api/academico/gestao
git commit -m "feat(academic): adiciona APIs de gestao"
```

### Task 4: Autenticação acadêmica e APIs do aluno

**Files:**
- Create: `apps/web/src/server/academic/studentAuth.ts`
- Create: `apps/web/src/server/academic/studentAuth.test.ts`
- Create: `apps/web/src/server/academic/studentPortalService.ts`
- Create: `apps/web/src/server/academic/studentPortalService.test.ts`
- Create: `apps/web/src/app/api/academico/auth/login/route.ts`
- Create: `apps/web/src/app/api/academico/auth/logout/route.ts`
- Create: `apps/web/src/app/api/academico/auth/me/route.ts`
- Create: `apps/web/src/app/api/academico/auth/trocar-senha/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/inicio/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/cursos/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/cursos/[id]/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/aulas/[id]/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/aulas/[id]/concluir/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/perfil/route.ts`
- Create: `apps/web/src/app/api/academico/aluno/route.test.ts`
- Modify: `apps/web/src/proxy.ts`
- Modify: `apps/web/src/components/layout/LayoutShell.tsx`

**Interfaces:**
- Produces: `StudentSession { studentId: string; institutionId: string; issuedAt: number; expiresAt: number; mustChangePassword: boolean }`.
- Produces: `authenticateStudent(email: string, password: string): Promise<StudentSession | null>`, `readStudentSession(): Promise<StudentSession | null>`, `readStudentSessionValue(value: string | undefined): StudentSession | null`, `startStudentSession(session): Promise<void>`, `endStudentSession(): Promise<void>`, `requireActiveStudent(options?: { allowPasswordChange?: boolean }): Promise<AcademicStudent>`.
- Uses cookie `viver_mais_student_session`, never `viver_mais_session`.
- Signs with `AUTH_SESSION_SECRET` using an `academic:` domain prefix, so a valid clinical payload/signature cannot be replayed as an academic session.
- Produces: `StudentPortalService` methods `getDashboard`, `listCourses`, `getCourse`, `getLesson`, `completeLesson`, `getProfile`, `updateProfile`, and `changePassword`.

- [x] **Step 1: Read the required local Next.js documentation**

Read the route-handler, cookies, proxy, authentication and dynamic-route files named in Global Constraints. Record no code changes in this step.

- [x] **Step 2: Write failing session/auth tests**

Tests must assert distinct cookie name, signature/expiry rejection, successful credential verification, mandatory password-change flag, and coexistence with an untouched professional cookie.

- [x] **Step 3: Run auth tests and verify failure**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/studentAuth.test.ts`  
Expected: FAIL because `studentAuth` does not exist.

- [x] **Step 4: Implement student session and authentication**

Use `verifyPasswordHash` from Task 3 without sharing the clinical cookie. Every protected call reloads the student row and rejects `disabled`, even if the signed cookie is still valid.

- [x] **Step 5: Write failing portal-service tests**

Cover own-scope reads, active enrollment filtering, draft exclusion, disabled account, suspended enrollment with an old session, idempotent repeated completion, profile field allowlist, and password change clearing `mustChangePassword`.

- [x] **Step 6: Implement portal service and run its tests**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/studentPortalService.test.ts`  
Expected: PASS after the minimal service implementation.

- [x] **Step 7: Write failing student-route tests**

Assert invalid credentials return 401, temporary login returns `destination: '/aluno/trocar-senha'`, protected content rejects before password change, student A cannot select student B via query/body fields, and repeated completion returns the same progress summary.

- [x] **Step 8: Implement auth/student routes and proxy isolation**

Treat every `/aluno` page as outside the clinical `LayoutShell`. In `proxy.ts`, leave only `/aluno/login` public, validate `viver_mais_student_session` for other `/aluno` pages with `readStudentSessionValue`, and redirect missing/invalid sessions to `/aluno/login`. Add `/api/academico/` to the explicit persistent API prefixes. Ensure a student cookie never authorizes `/gestao`, `/cockpit`, or clinical APIs.

- [x] **Step 9: Verify the full auth/API slice**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/studentAuth.test.ts src/server/academic/studentPortalService.test.ts src/app/api/academico/aluno/route.test.ts`  
Expected: PASS.

- [x] **Step 10: Commit**

```bash
git add apps/web/src/server/academic apps/web/src/app/api/academico apps/web/src/proxy.ts apps/web/src/components/layout/LayoutShell.tsx
git commit -m "feat(academic): adiciona acesso do aluno"
```

### Task 5: Interface de gestão acadêmica

**Files:**
- Create: `apps/web/src/app/gestao/academico/page.tsx`
- Create: `apps/web/src/components/academic/management/AcademicManagement.tsx`
- Create: `apps/web/src/components/academic/management/StudentsPanel.tsx`
- Create: `apps/web/src/components/academic/management/StudentForm.tsx`
- Create: `apps/web/src/components/academic/management/CoursesPanel.tsx`
- Create: `apps/web/src/components/academic/management/CourseEditor.tsx`
- Create: `apps/web/src/components/academic/management/ModuleEditor.tsx`
- Create: `apps/web/src/components/academic/management/LessonEditor.tsx`
- Create: `apps/web/src/components/academic/management/EnrollmentsPanel.tsx`
- Create: `apps/web/src/components/academic/management/AcademicManagement.test.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

**Interfaces:**
- Consumes: management APIs from Task 3.
- `AcademicManagement` owns only selected tab and data refresh boundaries.
- Each form submits a typed DTO matching exactly one management endpoint.
- Sidebar item: `{ label: 'Área de Alunos', href: '/gestao/academico' }` with a graduation/student icon.

- [x] **Step 1: Write failing static-render/component tests**

Assert the three tabs are present, student form includes temporary-password guidance, course editor exposes draft/publish state, lesson form labels the field as Vimeo-only, and no component renders clinical fields.

- [x] **Step 2: Run component tests and verify failure**

Run: `npm run test --workspace @thats-life/web -- --run src/components/academic/management/AcademicManagement.test.tsx`  
Expected: FAIL because components do not exist.

- [x] **Step 3: Implement the page shell and student/matriculation panels**

Use the current management visual language and shared button/input classes. Include loading, empty, success, validation, network-error and confirmation states. Do not display a stored password after create/reset.

- [x] **Step 4: Implement course, module and lesson editors**

Provide explicit move-up/move-down controls for ordering; do not add drag-and-drop dependencies. Clearly distinguish `ativo` and `publicado` for courses and rascunho/publicado for lessons.

- [x] **Step 5: Add navigation and verify component tests**

Run: `npm run test --workspace @thats-life/web -- --run src/components/academic/management/AcademicManagement.test.tsx`  
Expected: PASS.

- [x] **Step 6: Run targeted lint/typecheck**

Run: `npm run lint --workspace @thats-life/web -- --max-warnings=0 && npm run typecheck --workspace @thats-life/web`  
Expected: both exit 0.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/app/gestao/academico apps/web/src/components/academic/management apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat(academic): adiciona gestao de alunos e cursos"
```

### Task 6: Portal visual do aluno e player Vimeo

**Files:**
- Create: `apps/web/src/app/aluno/login/page.tsx`
- Create: `apps/web/src/app/aluno/trocar-senha/page.tsx`
- Create: `apps/web/src/app/aluno/page.tsx`
- Create: `apps/web/src/app/aluno/cursos/page.tsx`
- Create: `apps/web/src/app/aluno/cursos/[cursoId]/page.tsx`
- Create: `apps/web/src/app/aluno/aulas/[aulaId]/page.tsx`
- Create: `apps/web/src/app/aluno/minha-conta/page.tsx`
- Create: `apps/web/src/components/academic/student/StudentShell.tsx`
- Create: `apps/web/src/components/academic/student/StudentLoginForm.tsx`
- Create: `apps/web/src/components/academic/student/ForcePasswordChange.tsx`
- Create: `apps/web/src/components/academic/student/StudentDashboard.tsx`
- Create: `apps/web/src/components/academic/student/CourseGrid.tsx`
- Create: `apps/web/src/components/academic/student/CourseDetail.tsx`
- Create: `apps/web/src/components/academic/student/VimeoLessonPlayer.tsx`
- Create: `apps/web/src/components/academic/student/vimeoPlayer.ts`
- Create: `apps/web/src/components/academic/student/vimeoPlayer.test.ts`
- Create: `apps/web/src/components/academic/student/StudentAccount.tsx`
- Create: `apps/web/src/components/academic/student/studentViews.test.tsx`

**Interfaces:**
- Consumes: student auth/content/profile APIs from Task 4.
- `VimeoLessonPlayer({ lessonId, vimeoId, title, onCompleted })` loads `https://player.vimeo.com/api/player.js`, binds exactly one `ended` listener, destroys the player on cleanup, and calls `onCompleted(lessonId)`.
- `bindVimeoEnded(player: VimeoPlayerPort, onEnded: () => void): () => void` contains the testable subscription/cleanup boundary without requiring a DOM test environment.
- `StudentShell` navigation contains only Visão geral, Cursos e aulas, Minha conta, and logout.

- [x] **Step 1: Write failing student-view tests**

Assert login copy identifies the student environment, dashboard renders continue/progress states, empty enrollment is explicit, course detail preserves module/lesson order, account form omits protected fields, and student navigation contains no clinical or management links.

- [x] **Step 2: Run view tests and verify failure**

Run: `npm run test --workspace @thats-life/web -- --run src/components/academic/student/studentViews.test.tsx`  
Expected: FAIL because student components do not exist.

- [x] **Step 3: Implement login, forced password change and shell**

Use the Viver Mais logo and design tokens, but keep the shell independent from `LayoutShell`. Redirect authenticated students according to `mustChangePassword`; logout removes only the academic cookie.

- [x] **Step 4: Implement dashboard, course grid and course detail**

Show percentage and counts from the server, not recalculated from hidden data in the browser. Provide explicit loading, no-enrollment, no-published-lessons, suspended and expired-session states.

- [x] **Step 5: Write the Vimeo event binding test**

Test `bindVimeoEnded` with a fake player and assert one `ended` subscription and cleanup. In the view test, inject the completion callback and assert duplicate in-flight suppression, successful repeated API response handling, and visible retry after a failed completion request.

- [x] **Step 6: Implement player and automatic completion**

Build embed URLs from normalized IDs with `dnt=1`, title/byline disabled and fullscreen allowed. Do not show a manual “mark complete” button. Disable duplicate in-flight requests but accept later retries.

- [x] **Step 7: Implement My Account and page containers**

Allow only name, optional phone and password change. Keep session-derived identity authoritative.

- [x] **Step 8: Verify student UI**

Run: `npm run test --workspace @thats-life/web -- --run src/components/academic/student/studentViews.test.tsx src/components/academic/student/vimeoPlayer.test.ts && npm run typecheck --workspace @thats-life/web`  
Expected: PASS and TypeScript exits 0.

- [x] **Step 9: Commit**

```bash
git add apps/web/src/app/aluno apps/web/src/components/academic/student
git commit -m "feat(academic): adiciona portal visual do aluno"
```

### Task 7: Verificação integral e documentação operacional

**Files:**
- Create: `apps/web/src/server/academic/academicJourney.test.ts`
- Modify: `README.md`

**Interfaces:**
- Consumes: all previous task interfaces.
- Produces: documented local demo credentials/setup only through environment or seed instructions; no production default password.

- [x] **Step 1: Write an integration-style academic journey test**

Using an in-memory/fake `AcademicRepository`, exercise: admin creates student with temporary password → creates/publishes course, module and Vimeo lesson → enrolls student → student must change password → student loads course → completion event is recorded → dashboard returns 100% → suspending enrollment blocks content but preserves completion → reactivation restores 100%.

- [x] **Step 2: Run the journey test and fix integration gaps**

Run: `npm run test --workspace @thats-life/web -- --run src/server/academic/academicJourney.test.ts`  
Expected: PASS.

- [x] **Step 3: Document setup and environment behavior**

Document migration `053`, management route, student login route, Vimeo-only rule, temporary-password flow, separate cookie, use of the existing required `AUTH_SESSION_SECRET`, and local seed/demo procedure. No production default password may be documented.

- [x] **Step 4: Run the full automated verification**

Run: `npm run lint && npm run typecheck && npm run test && npm run web:build`  
Expected: all commands exit 0.

- [x] **Step 5: Run migration dry-run** — *sem MySQL local; o `separarComandos` do migrador processou 053 (22 comandos) e 054 (9) sem erro. Rodar `npm run db:status` contra o banco real antes do deploy.*

Run: `npm run db:status`  
Expected: migration 053 appears pending on an unmigrated environment or applied on a current one, with no parser error.

- [x] **Step 6: Perform responsive browser verification** — *parcial: `/aluno/login` verificado em 1366px e 390px, sem overflow; redirects de `/aluno/*` e `/gestao/academico` conferidos. As páginas autenticadas exigem MySQL e ainda precisam de checagem visual.*

Verify desktop and mobile widths for `/gestao/academico`, `/aluno/login`, `/aluno`, `/aluno/cursos/[cursoId]`, `/aluno/aulas/[aulaId]`, and `/aluno/minha-conta`. Confirm menus, empty states, modal/form focus, Vimeo aspect ratio, long course titles and network-error recovery.

- [x] **Step 7: Check the deployment routing invariant**

Inspect `vercel.json`, `apps/web/vercel.json`, `apps/web/next.config.mjs`, and `apps/web/src/proxy.ts`. Confirm only `/api/academico/*` joins the persistent backend proxy and no global `/:path*` rewrite exists.

- [x] **Step 8: Commit**

```bash
git add apps/web/src/server/academic/academicJourney.test.ts README.md
git commit -m "test(academic): valida jornada completa do aluno"
```

## Execução — 2026-10-13

- Commits: `a37c39e` (T1), `2260822` (T2), `f6bda94` (T3), `871cf5b` (T4), `0594276` (T5), `f56f2f1` (T6), `13ecbc5` (T7), `7ec85f9` e `1b36c9b` (correções).
- Revisão final: sem achados críticos. Os 5 importantes foram corrigidos em `1b36c9b`, que também cria a migration `054_portal_aluno_sessao_vimeo.sql`: sessões revogadas após troca/redefinição de senha, senha atual exigida na troca voluntária, fim do loop de redirect no proxy, hash de Vimeo não listado preservado, confirmações e edição de aulas/módulos na gestão.
- Verificação: lint 0, typecheck 0 (o arquivo gerado `.next/dev` pelo `next dev` em execução estava corrompido e foi excluído da checagem), 679 testes passando, build 0.
- Menores adiados: erros de constraint do banco viram 500 genérico; `updateLesson` ecoa um `moduleId` que não foi salvo; a reordenação usa dois PATCH; o fallback de senha em texto puro no `AUTH_USERS_JSON` deixou de valer; o login de conta desativada mostra mensagem genérica; `INSERT IGNORE` esconde erros de FK; o editor de curso não volta para "novo curso" sem recarregar.

## Final Acceptance

- [x] Gestão cria uma conta acadêmica sem tocar na identidade profissional.
- [x] Primeiro acesso força troca de senha e libera o portal somente depois dela.
- [x] Gestão publica curso, módulo e aula Vimeo e matricula um aluno.
- [x] Aluno vê somente suas matrículas e conteúdo publicado.
- [x] Vimeo concluído atualiza o progresso automaticamente e de forma idempotente.
- [x] Suspensões bloqueiam acesso sem apagar histórico.
- [x] Cookies profissional e acadêmico coexistem e não atravessam autoridades.
- [x] Nenhum componente novo ultrapassa 250 linhas.
- [x] Lint, typecheck, testes e build passam.
- [x] O deploy mantém o frontend do monorepo na raiz e encaminha somente APIs específicas.

## Pendências conhecidas

Consolidação dos itens desmarcados e das pendências explícitas deste registro histórico. O estado abaixo reproduz o plano; não constitui uma nova auditoria do código ou da produção. Consulte as etapas originais para detalhes e confirme o estado atual antes de retomar o trabalho.

Pendências registradas em “Execução — 2026-10-13” como menores adiados:

- [ ] Tratar erros de constraint do banco que viram 500 genérico.
- [ ] Corrigir `updateLesson`, que ecoa um `moduleId` que não foi salvo.
- [ ] Revisar a reordenação que usa dois PATCH.
- [ ] Revisar a mudança no fallback de senha em texto puro de `AUTH_USERS_JSON`, registrado como tendo deixado de valer, sem reintroduzir credenciais inseguras.
- [ ] Melhorar a mensagem genérica no login de conta desativada.
- [ ] Revisar `INSERT IGNORE`, que esconde erros de FK.
- [ ] Permitir que o editor de curso volte para “novo curso” sem recarregar.

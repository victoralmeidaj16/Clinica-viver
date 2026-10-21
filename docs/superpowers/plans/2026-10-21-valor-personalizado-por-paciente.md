# Valor personalizado por paciente Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que Gestão configure Acessível, Particular ou Personalizado e um valor individual por paciente, aplicado apenas a agendamentos novos.

**Architecture:** O paciente guardará somente a categoria financeira e, em Personalizado, o valor em centavos. A agenda resolve o preço no servidor quando cria o agendamento e grava o snapshot em `clinica_agendamentos.valor_centavos`; o painel administrativo só altera a configuração futura por uma rota protegida de Gestão.

**Tech Stack:** Next.js 16 App Router, TypeScript, React, Vitest, MySQL 8, mysql2 e Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-21-valor-personalizado-por-paciente-design.md`

## Global Constraints

- A alteração é restrita ao perfil `admin` usado por `exigirGestao`.
- Valores monetários atravessam a API como centavos inteiros; a UI converte BRL para centavos.
- Somente novos `clinica_agendamentos` usam a nova configuração; nunca atualizar `valor_centavos` existente.
- Componentes React devem permanecer modulares e abaixo de 250 linhas.
- Não expor configuração de preço em links ou rotas públicas de agenda.

## Review Focus

- Valor `0`, negativo, decimal inválido ou maior que `Number.MAX_SAFE_INTEGER` é rejeitado antes de persistir.
- Categoria `personalizado` sem valor e categoria não personalizada com valor são rejeitadas/normalizadas para não deixar estado ambíguo.
- Um paciente sem configuração mantém precisamente o fallback legado baseado na modalidade da triagem.
- Reagendamento não recalcula nem substitui o `valor_centavos` que já foi gravado no agendamento original.
- Um ID de paciente de outra organização não pode ser lido nem atualizado pela rota de Gestão.

### Task 1: Contrato financeiro do paciente e migração idempotente

**Files:**
- Create: `infra/mysql/064_valor_sessao_personalizado.sql`
- Create: `apps/web/src/server/persistence/mysql/patientSessionPricing.ts`
- Create: `apps/web/src/server/persistence/mysql/patientSessionPricing.test.ts`

**Interfaces:**
- Produces: `PatientSessionPricingCategory = 'acessivel' | 'particular' | 'personalizado'`.
- Produces: `PatientSessionPricing = { category: PatientSessionPricingCategory | null; customAmountCents: number | null }`.
- Produces: `validatePatientSessionPricing(input: Record<string, unknown>): PatientSessionPricing` and `updatePatientSessionPricing(organizationId: string, patientRef: string, pricing: PatientSessionPricing): Promise<void>`.

- [ ] **Step 1: Write failing validation and persistence tests**

Test `personalizado` with `7500`, Acessível/Particular clearing the custom value, invalid categories, missing custom amount, zero, negative, fractional and cross-organization/not-found update behavior.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run apps/web/src/server/persistence/mysql/patientSessionPricing.test.ts`

Expected: FAIL because the pricing module does not exist.

- [ ] **Step 3: Add migration and persistence module**

Create migration 064 with guarded additions of `categoria_valor_sessao` and `valor_sessao_personalizado_centavos` to `clinica_pacientes`; add a CHECK-compatible invariant through application validation rather than relying on a MySQL version-specific CHECK. Implement validation in the module and an organization-scoped `UPDATE clinica_pacientes JOIN clinica_organizacoes` that throws on zero affected rows.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run apps/web/src/server/persistence/mysql/patientSessionPricing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add infra/mysql/064_valor_sessao_personalizado.sql apps/web/src/server/persistence/mysql/patientSessionPricing.ts apps/web/src/server/persistence/mysql/patientSessionPricing.test.ts
git commit -m "feat: persiste valor personalizado por paciente"
```

### Task 2: Rota administrativa e dados do drawer

**Files:**
- Create: `apps/web/src/app/api/application/gestao/pacientes/[id]/valor-sessao/route.ts`
- Modify: `apps/web/src/app/api/application/gestao/pacientes/route.ts`
- Modify: `apps/web/src/components/patients/managementTypes.ts`
- Create: `apps/web/src/app/api/application/gestao/pacientes/[id]/valor-sessao/route.test.ts`

**Interfaces:**
- Consumes: `validatePatientSessionPricing` and `updatePatientSessionPricing` from Task 1.
- Produces: `PUT /api/application/gestao/pacientes/:id/valor-sessao`, body `{ category: 'acessivel' | 'particular' | 'personalizado'; customAmountCents?: number }`.
- Produces: `ManagedPatient.sessionPricing: { category: PatientSessionPricingCategory | null; customAmountCents?: number }`.

- [ ] **Step 1: Write failing route and list-payload tests**

Mock `exigirGestao` and the repository to prove admin success, unauthenticated/forbidden failures, invalid body 400, missing/out-of-scope patient 404, and that the management list returns the persisted category and custom cents without any clinical content.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run 'apps/web/src/app/api/application/gestao/pacientes/[id]/valor-sessao/route.test.ts'`

Expected: FAIL because the route and payload fields do not exist.

- [ ] **Step 3: Implement route and list projection**

Call `exigirGestao`, parse JSON defensively, call Task 1 validation/persistence, and return `{ success: true, data }` following the nearby management routes. Extend the existing MySQL patient query in the list route and map the two fields into `ManagedPatient`; no new endpoint may disclose the data to a public scheduling caller.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run 'apps/web/src/app/api/application/gestao/pacientes/[id]/valor-sessao/route.test.ts'`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app/api/application/gestao/pacientes apps/web/src/components/patients/managementTypes.ts
git commit -m "feat: expõe configuração financeira do paciente à gestão"
```

### Task 3: Resolver e congelar o preço de novos agendamentos

**Files:**
- Modify: `apps/web/src/server/scheduling/agendaRepository.ts`
- Modify: `apps/web/src/server/scheduling/patientCpfAccess.test.ts`
- Modify: `apps/web/src/server/scheduling/publicBooking.test.ts`

**Interfaces:**
- Consumes: `PatientSessionPricing` semantics from Task 1.
- Produces: `resolveSessionAmountCents({ category, customAmountCents, triageMode, socialAmountCents, standardAmountCents }): number` in `agendaRepository.ts` (or a narrow adjacent module if extraction keeps the repository below 250 lines per unit).
- Produces: `PacienteIdentificado.sessionAmountCents` resolved from patient pricing before the triage fallback.

- [ ] **Step 1: Write failing schedule-resolution tests**

Extend the SQLite fixture with the two new patient columns. Assert personalized `7500` wins over triage and professional defaults; Acessível uses social; Particular uses standard; null configuration preserves social/standard fallback. In public booking tests, assert the value passed to the `INSERT INTO clinica_agendamentos` is the resolved snapshot and is not changed by a later patient update.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- --run apps/web/src/server/scheduling/patientCpfAccess.test.ts apps/web/src/server/scheduling/publicBooking.test.ts`

Expected: FAIL because pricing columns are not selected or resolved.

- [ ] **Step 3: Implement server-side price resolution**

Select the patient pricing columns in both `identifyPatient` queries, validate the persisted value defensively, resolve `sessionAmountCents` with precedence Custom → Acessível → Particular → triage fallback, and keep `bookAppointments` inserting that value unchanged. Do not accept any client-provided price and do not modify rescheduling or existing charge queries.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- --run apps/web/src/server/scheduling/patientCpfAccess.test.ts apps/web/src/server/scheduling/publicBooking.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/server/scheduling/agendaRepository.ts apps/web/src/server/scheduling/patientCpfAccess.test.ts apps/web/src/server/scheduling/publicBooking.test.ts
git commit -m "feat: aplica preço individual em novos agendamentos"
```

### Task 4: Painel “Categoria e valor da sessão” na Gestão

**Files:**
- Create: `apps/web/src/components/patients/PatientSessionPricingPanel.tsx`
- Create: `apps/web/src/components/patients/PatientSessionPricingPanel.test.tsx`
- Modify: `apps/web/src/components/patients/PatientManagementDrawer.tsx`
- Modify: `apps/web/src/components/patients/patientManagementActions.ts`
- Modify: `apps/web/src/app/gestao/pacientes/page.tsx`

**Interfaces:**
- Consumes: `ManagedPatient.sessionPricing` from Task 2.
- Produces: `updatePatientSessionPricing(patientId: string, input: { category: PatientSessionPricingCategory; customAmountCents?: number }): Promise<void>` in `patientManagementActions.ts`.
- Produces: a controlled `PatientSessionPricingPanel` with `onChange(): Promise<void>`.

- [ ] **Step 1: Write failing component/action tests**

Render the panel with the three categories and assert: Acessível/Particular hide and clear the amount; Personalizado requires a valid BRL amount and displays `R$ 75,00`; the summary identifies the patient-only configuration; failed save leaves the editor open with an error; successful save calls the narrow management action.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- --run apps/web/src/components/patients/PatientSessionPricingPanel.test.tsx`

Expected: FAIL because the panel and action do not exist.

- [ ] **Step 3: Implement the isolated panel and wire page refresh**

Create a sub-250-line panel styled alongside `PatientConvenioPanel`, use accessible radio buttons or buttons for the three categories, format/parse BRL without floating-point persistence, and place it in `PatientManagementDrawer` next to the existing administrative configuration. Add the management fetch action with idempotency headers; on success call the page `load()` callback so the drawer summary renders fresh server state.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- --run apps/web/src/components/patients/PatientSessionPricingPanel.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/patients/PatientSessionPricingPanel.tsx apps/web/src/components/patients/PatientSessionPricingPanel.test.tsx apps/web/src/components/patients/PatientManagementDrawer.tsx apps/web/src/components/patients/patientManagementActions.ts apps/web/src/app/gestao/pacientes/page.tsx
git commit -m "feat: permite gestão personalizar valor da sessão"
```

### Task 5: Regressão integrada e verificação de produção

**Files:**
- Modify: only files surfaced by failed checks from Tasks 1–4.

**Interfaces:**
- Consumes: all completed contracts.
- Produces: verified build and migration-safe release.

- [ ] **Step 1: Run all targeted tests and inspect results**

Run: `npm test -- --run apps/web/src/server/persistence/mysql/patientSessionPricing.test.ts 'apps/web/src/app/api/application/gestao/pacientes/[id]/valor-sessao/route.test.ts' apps/web/src/server/scheduling/patientCpfAccess.test.ts apps/web/src/server/scheduling/publicBooking.test.ts apps/web/src/components/patients/PatientSessionPricingPanel.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run type/build verification**

Run: `npm run web:build`

Expected: Next.js production build succeeds with no TypeScript errors.

- [ ] **Step 3: Validate migration ordering without credentials**

Run: `node infra/mysql/migrate.mjs --dry-run`

Expected: reports the missing database URL only; separately inspect that migration 064 is numerically after 063 and idempotent. In the VPS deploy, `npm run db:migrate` is the authorized executor with production credentials.

- [ ] **Step 4: Commit any verification-driven correction**

```bash
git add <only corrected files>
git commit -m "test: cobre valor personalizado por paciente"
```

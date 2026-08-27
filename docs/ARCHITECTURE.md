# Arquitetura Técnica — Clínica Viver Mais

## Visão Geral do Sistema

A **Clínica Viver Mais** adota uma arquitetura em Monorepo utilizando **TypeScript** de ponta a ponta, separando as aplicações de front-end e cockpit (`apps/web`) do pacote central de regras de negócio, IA clínica e integrações (`packages/core`).

> **Estado atual (Agosto/2026).** A produção utiliza Vercel para entrega de páginas, assets estáticos e rotas públicas/SPA, e uma VPS Hostinger privada para o backend persistente, MySQL 8.4 e Evolution API.
>
> Os dados são persistidos relacionalmente através dos adaptadores em `apps/web/src/server/persistence/mysql` (prontuários SOAP, histórico da linha do tempo, sessões clínicas, cadastros, auditoria, regras financeiras e certificados digitais).
>
> A autenticação é provida por cookies HTTP seguros assinados (`viver_mais_session`) com derivação de chave criptográfica (`scrypt`/HMAC) e verificação contra o banco de dados. Sem `DATABASE_URL` configurada, a aplicação opera em modo demonstração com adaptadores em memória.
>
> Detalhes de infraestrutura e roteiro de deploy: [`docs/hostinger-vps.md`](./hostinger-vps.md) e [`docs/vercel-setup-guia.md`](./vercel-setup-guia.md).

```mermaid
flowchart TD
    subgraph ClientLayer ["Camada de Clientes"]
        WEB["💻 Web Cockpit & Gestão (Next.js 16 App Router)"]
        PUBLIC["🌐 Vitrine Pública & Validação de Certificados"]
    end

    subgraph ServiceLayer ["Camada Core (@thats-life/core)"]
        SOAP["🧠 Motor de Prontuário SOAP & Timeline"]
        EVO["💬 Evolution API Client (WhatsApp)"]
        FIN["💳 Financial & Pix Engine (Asaas)"]
        SCHEDULE["📅 Agenda, disponibilidade e rodízio"]
        CERT["🎓 Certificados Digitais & QR Code"]
        ANON["🛡️ Anonymization Engine (LGPD/CFP)"]
    end

    subgraph EdgeLayer ["Entrega Web & CDN"]
        VERCEL["▲ Vercel (Edge, Next.js Pages & Assets)"]
    end

    subgraph InfraLayer ["VPS Hostinger & Persistência"]
        PROXY["🔒 Caddy HTTPS / Reverse Proxy"]
        NODE["⚙️ Backend Node.js Persistente"]
        DB["🐬 MySQL 8.4 Docker (Rede Privada)"]
        EXT_EVO["💬 Evolution API (Container Dedicado)"]
    end

    WEB --> VERCEL
    PUBLIC --> VERCEL
    VERCEL --> PROXY
    PROXY --> NODE
    NODE --> ServiceLayer
    ServiceLayer --> DB
    ServiceLayer --> EXT_EVO
```

---

## 🛠️ Tecnologias Principais

1. **Aplicações Front-End:**
   * **Web:** Next.js 16 (React 19), Tailwind CSS / Vanilla CSS, Lucide Icons.
   * **Cockpit Clínico & Gestão:** Painel administrativo unificado com abas operacionais (Leads, Agenda, Pacientes, Meu Financeiro, Cockpit Clínico, Gestão de Psicólogos, DRE e 11 Indicadores).
   * **Páginas Públicas:** Vitrine de captação (`/vitrine`), Agendamento com seleção de serviços/público (`/agendar`), Checkout transparente de cobrança (`/pagar`) e Validação pública de certificados (`/validar-certificado`).
2. **Pacote Core (`@thats-life/core`):**
   * TypeScript strictly-typed.
   * Regras clínicas, cálculo de hash SHA-256 de prontuários, motor de rodízio (Round-Robin), split 70/30 e geração/validação de certificados.
   * Adaptadores para Asaas (Pix/cartão), Evolution API (WhatsApp) e NFS-e nacional.
3. **Persistência & Backend:**
   * **Persistência Relacional:** MySQL 8.4 em container Docker na VPS Hostinger, banco `viver_mais_clinica`. Schema estruturado com migrations em `infra/mysql` (`004_clinica.sql`, `007_thats_life_core.sql`, `008_certificados_mysql.sql`, etc.).
   * **Repositórios Ativos:**
     - `identityRepository.ts`: Perfis, credenciais, membros organizacionais e controle de visibilidade/capacidade de psicólogos.
     - `appointmentRepository.ts`: Agendamentos, bloqueios e conciliação de horários.
     - `clinicalSessionRepository.ts` & `clinicalRecordRepository.ts`: Sessões clínicas e prontuários SOAP versionados com hash SHA-256 e auditoria.
     - `clinicalTimelineRepository.ts`: Linha do tempo longitudinal com busca determinística (*evidence-only*).
     - `financialRepository.ts`: Cobranças, descontos, conciliação Pix/Asaas, repasses e expiração automática.
     - `convenioRepository.ts`: Faturamento de convênios PJ e contratos corporativos.
     - `captureRepository.ts`: Leads de triagem, SLA de 24h e rodízio de distribuição.
     - `clinicalAccessAuditRepository.ts`: Registro imutável de acessos e auditoria cadastral.
     - `certificadosRepository.ts`: Registro de certificados emitidos, código alfanumérico, carimbo com QR code e renderização limpa de PDF.
   * **Autenticação & Segurança:**
     - Implementada no servidor em `apps/web/src/server/auth.ts`.
     - Sessão baseada em cookies HTTP seguros (`viver_mais_session`) com assinatura HMAC-SHA256 e TTL de 8 horas.
     - Senhas protegidas com derivação de chave criptográfica `scrypt` com salt aleatório e comparação em tempo constante (`timingSafeEqual`).
     - Controle de acesso baseado em papéis (RBAC): perfis `admin` (gestão completa, DRE, limites de profissionais) e `psicologo` (acesso estrito à própria agenda, pacientes e prontuários).

---

## Domínio Financeiro & Split 70/30

O módulo `packages/core/src/financial` não depende de banco, framework web ou provedor de pagamentos. Valores são armazenados em **centavos inteiros** e todas as entidades carregam os identificadores de organização, sessão, paciente e profissional necessários para isolamento multi-tenant e conciliação.

O módulo `packages/core/src/financial` não depende de banco, framework web ou
provedor de pagamentos. Valores são armazenados em **centavos inteiros** e todas
as entidades carregam os identificadores de organização, sessão, paciente e
profissional necessários para isolamento multi-tenant e conciliação.

```mermaid
flowchart LR
    SESSION["Sessão"] --> CHARGE["Cobrança"]
    CHARGE --> DISCOUNT["Desconto"]
    CHARGE --> PAYMENT["Pagamento"]
    PAYMENT --> REFUND["Estorno"]
    PAYMENT --> FEE["Taxa"]
    CHARGE --> TRANSFER["Repasse"]
    CHARGE --> RECON["Conciliação"]
    RECON --> REPORTS["Relatórios"]
    REPORTS --> CSV["CSV"]
    REPORTS --> PDF["PDF"]
```

### Camadas implementadas

1. **Domínio:** cobranças, descontos, pagamentos, estornos, taxas e repasses.
2. **Conciliação:** saldo por sessão, pagamento parcial, excesso, estorno,
   vencimento e cancelamento.
3. **Consultas:** período, organização, paciente, profissional, status e forma
   de pagamento.
4. **Relatórios:** faturamento, fluxo de caixa, contas a receber,
   inadimplência e repasses.
5. **Saídas:** CSV com separador compatível com Excel em português e PDF A4.
6. **Portas externas:** repositório, auditoria, idempotência, cobrança/Pix,
   webhook normalizado, NFSe e Receita Saúde.

`InMemoryFinancialRepository` é apenas um adaptador de desenvolvimento e testes rápidos.
Em produção, a persistência é gerenciada por `financialRepository.ts` no MySQL, enquanto
o Asaas implementa `BillingProviderPort` com expiração configurável e cobrança Pix/cartão.
Webhooks validam assinatura e passam por `IdempotencyRepository` antes de alterar o livro-razão.

Logs de auditoria não podem carregar nome, e-mail, telefone, CPF, transcrição ou
nota clínica do paciente. Documentos fiscais são uma exceção controlada e devem
ficar em coleção restrita, criptografada e com política própria de retenção.

---

## Identidade e Multi-Tenancy

O módulo `packages/core/src/identity` define identidade e autorização sem
dependência de Firebase, Clerk, Auth0 ou qualquer banco. O provedor futuro deverá
implementar `AuthenticationPort`, enquanto a persistência implementará
`IdentityRepository`.

```mermaid
flowchart LR
    USER["Identidade global"] --> MEMBERSHIP["Vínculo organizacional"]
    ORG["Clínica / consultório"] --> MEMBERSHIP
    MEMBERSHIP --> ROLE["Papel RBAC"]
    MEMBERSHIP --> PROFESSIONAL["Perfil profissional"]
    ORG --> PATIENT["Perfil do paciente"]
    PATIENT --> RESPONSIBLE["Vínculo com responsável"]
```

### Regras de isolamento

1. Toda consulta de perfil exige `organizationId`; IDs isolados não concedem
   acesso.
2. A verificação de tenant ocorre antes da avaliação de papel ou permissão.
3. Um vínculo pode combinar papéis, como `owner + professional`, sem transformar
   permissões administrativas em permissões clínicas.
4. Proprietários e administradores não acessam prontuários automaticamente.
5. Profissionais acessam recursos clínicos somente de pacientes atribuídos ao
   próprio `professionalProfileId`.
6. Pacientes e responsáveis não são membros da clínica. Seus contextos são
   resolvidos pelo usuário autenticado e pelos vínculos explícitos.
7. O responsável não recebe acesso clínico automaticamente, mesmo quando sua
   autoridade é `legal_guardian`; cada capacidade deve ser concedida.
8. A organização deve manter ao menos um proprietário ativo.

### Papéis organizacionais

- `owner` e `admin`: administração organizacional, financeira e de membros, sem
  acesso automático ao prontuário.
- `clinical_director`: operação clínica e supervisão, sem gerenciar membros.
- `professional`: prontuário, sessões e avaliações dos pacientes atribuídos.
- `assistant`: cadastro, agenda e leitura financeira, sem prontuário.
- `billing`: cobrança, relatórios e dados mínimos de pacientes.
- `auditor`: leitura de auditoria, relatórios e finanças.

Credenciais, senhas e tokens nunca pertencem ao domínio. O core recebe apenas um
`AuthenticatedPrincipal` verificado pelo adaptador de autenticação e resolve o
contexto autorizado a partir dos vínculos armazenados.

---

## Sessão Clínica e Automação Pós-Sessão

O agregado `ClinicalSession`, em `packages/core/src/clinicalSession`, coordena o
ciclo da sessão sem depender de banco, fila, storage ou provedor de IA. Ele
mantém organização, paciente e profissionais atribuídos em todas as operações.

```mermaid
stateDiagram-v2
    [*] --> scheduled
    scheduled --> confirmed
    scheduled --> in_progress
    confirmed --> in_progress
    scheduled --> cancelled
    confirmed --> no_show
    in_progress --> awaiting_processing: encerra com transcrição
    in_progress --> awaiting_review: encerra sem transcrição
    awaiting_processing --> processing_failed
    processing_failed --> awaiting_processing: repetir
    awaiting_processing --> awaiting_review: rascunho pronto
    awaiting_review --> ready_to_complete: revisão humana
    ready_to_complete --> completed: automações concluídas
```

### Garantias do agregado

1. Gravação, processamento por IA e conteúdo entregue ao paciente possuem
   consentimentos separados, versionados e revogáveis.
2. A transcrição exige gravação vinculada, consentimento ativo e datas
   temporalmente consistentes.
3. Conteúdo gerado por IA nunca conclui a sessão sozinho: o prontuário requer
   aprovação humana.
4. Cobrança, recibo, notificação e entrega ao paciente são etapas rastreadas
   individualmente; a sessão só termina quando todas as etapas habilitadas
   estiverem concluídas.
5. Falhas de automação preservam código do erro e número de tentativas, e podem
   ser repetidas sem perder o histórico.
6. Comandos aceitam chave de idempotência e persistem agregado e eventos de
   outbox na mesma operação atômica.
7. Escritas usam versão otimista para impedir que duas operações sobrescrevam
   silenciosamente a mesma sessão.

### Portas de infraestrutura

- `ClinicalSessionRepository`: persistência transacional e consultas por
  organização, período, paciente, profissional e status.
- `SessionJobQueuePort`: despacho das automações pós-sessão.
- `RecordingStoragePort`: upload criptografado, confirmação por checksum,
  retenção e exclusão.
- `TranscriptionProviderPort`: transcrição desacoplada do fornecedor.
- `ClinicalDraftProviderPort`: geração desacoplada do rascunho clínico.

`InMemoryClinicalSessionRepository` é o adaptador de desenvolvimento e testes.
Uma implementação real deverá manter atomicidade entre a sessão, a chave de
idempotência e a outbox, independentemente da tecnologia de banco escolhida.

---

## Prontuário Clínico Versionado

O módulo `packages/core/src/clinicalRecord` representa o prontuário como um
agregado separado da sessão, da transcrição e do conteúdo compartilhado com o
paciente. O formato clínico atual é SOAP, mas nenhuma regra depende de uma API
de IA ou tecnologia de persistência.

```mermaid
flowchart LR
    TRANSCRIPTION["Referência da transcrição"] --> AI["Provedor de rascunho"]
    AI --> REV1["Revisão 1: rascunho"]
    REV1 --> APPROVAL1["Aprovação + hash"]
    APPROVAL1 --> CURRENT1["Versão clínica vigente"]
    CURRENT1 --> REV2["Revisão 2: retificação"]
    REV2 --> APPROVAL2["Nova aprovação + hash"]
    APPROVAL2 --> CURRENT2["Nova versão vigente"]
    CURRENT1 -. preservada .-> HISTORY["Histórico imutável"]
    CURRENT2 -. preservada .-> HISTORY
```

### Garantias clínicas e de auditoria

1. Um rascunho assistido por IA exige proveniência com fornecedor, modelo,
   versão do prompt, transcrição de origem e data de geração.
2. O resultado da IA permanece em estado de rascunho até um profissional
   atribuído revisar e aprovar explicitamente.
3. Cada aprovação registra profissional, usuário, data, atestado de revisão e
   hash SHA-256 do conteúdo aprovado.
4. Retificações adicionam uma nova revisão e uma nova aprovação. O conteúdo e a
   assinatura das revisões anteriores permanecem preservados.
5. Toda criação exige uma data explícita de retenção; uma retenção legal pode
   suspender a eliminação pelo adaptador de persistência.
6. Eventos de domínio e auditoria de acesso não carregam campos SOAP,
   transcrição ou texto clínico.
7. Proprietários e administradores continuam sem acesso clínico automático.
   Profissionais visualizam apenas prontuários dos pacientes atribuídos.
8. Criação e alterações usam idempotência, versão otimista e outbox atômica.

### Portas de infraestrutura

- `ClinicalRecordRepository`: armazenamento e consulta sempre limitados por
  `organizationId`.
- `ClinicalRecordDraftProviderPort`: geração de SOAP sem acoplar o domínio ao
  fornecedor de IA.
- `ClinicalRecordContentProtectionPort`: criptografia e abertura do conteúdo
  pelo adaptador servidor.
- `ClinicalRecordAccessAuditPort`: auditoria obrigatória de leituras, listagens
  e acessos negados.

`InMemoryClinicalRecordRepository` e `InMemoryClinicalRecordAccessAudit` existem
somente para testes e desenvolvimento. A persistência real deverá cifrar o
conteúdo em repouso e manter agregado, idempotência e outbox na mesma transação.

---

## Agenda e futura integração com Google Calendar

O módulo `packages/core/src/scheduling` separa **agendamento** de **sessão
clínica**. O primeiro reserva e coordena o horário; a sessão passa a existir no
fluxo de atendimento e pode ser vinculada posteriormente. Isso impede que uma
mudança de calendário altere registros clínicos já produzidos.

```mermaid
flowchart LR
    AVAIL["Disponibilidade e bloqueios"] --> APPOINTMENT["Agendamento"]
    APPOINTMENT --> CONFLICT["Validação de conflito"]
    APPOINTMENT --> REMINDER["Lembretes"]
    APPOINTMENT --> SESSION["Sessão clínica vinculada"]
    APPOINTMENT --> OUTBOX["Outbox de sincronização"]
    OUTBOX --> GOOGLE["Adaptador Google Calendar futuro"]
```

### Regras implementadas

1. Cada agendamento pertence a uma organização, paciente e profissional.
2. O sistema valida intervalo, lembretes duplicados, ciclo de estados,
   concorrência otimista e conflito de horários do profissional.
3. Apenas profissionais atribuídos ao paciente — ou papéis internos com a
   permissão de agenda — podem alterar o horário.
4. A agenda suporta contratos para disponibilidade semanal, bloqueios,
   recorrência, lembretes e vínculo posterior à sessão clínica.
5. Criação, confirmação, reagendamento e cancelamento geram eventos de outbox
   idempotentes, prontos para notificações e sincronização externa.

### Google Calendar: contrato futuro

`ExternalCalendarProviderPort` é a fronteira para o futuro adaptador Google.
Ele prevê OAuth, envio/atualização/remoção de eventos e sincronização incremental
por cursor. A conexão persiste apenas:

- identificador da conta no provedor;
- calendário selecionado;
- estado, cursor e datas de sincronização;
- referências de eventos externos.

Tokens OAuth, segredos do cliente e códigos de autorização não são armazenados
no core nem enviados ao app. Eles deverão ser processados e cifrados somente no
servidor, pelo adaptador Google Calendar. Assim, cada psicólogo poderá conectar
sua agenda individualmente sem compartilhar credenciais com a clínica ou com
outros profissionais.

---

## Plano terapêutico e acompanhamento do paciente

O módulo `packages/core/src/carePlan` mantém metas, tarefas e registros de
humor que podem aparecer no app do paciente, sem reutilizar nem expor campos do
prontuário SOAP. Tarefas são filtradas contra referências a prontuário,
diagnóstico ou conteúdo de risco antes de se tornarem compartilháveis.

1. Pacientes só podem concluir suas próprias tarefas e registrar o próprio
   humor.
2. Responsáveis só interagem quando o vínculo explícito concede a capacidade
   correspondente.
3. Humor muito baixo abre um alerta operacional para revisão humana; não cria
   diagnóstico, conduta ou mensagem automática.
4. As portas de repositório separam planos, check-ins e alertas, preparando a
   persistência e o painel clínico sem misturar dados com o prontuário.

---

## Preparação pré-sessão

O módulo `packages/core/src/preSessionCheckIn` coordena o check-in vinculado a
um agendamento. Ele aceita indicadores estruturados, uma avaliação validada e
um campo opcional para assuntos que o paciente queira abordar.

```mermaid
stateDiagram-v2
    [*] --> scheduled
    scheduled --> available
    available --> in_progress
    available --> submitted
    in_progress --> submitted
    available --> review_required: indicador de risco
    in_progress --> review_required: indicador de risco
    submitted --> reviewed
    review_required --> reviewed
    scheduled --> expired
    available --> expired
    in_progress --> expired
```

1. O paciente pode deixar `topicsToDiscuss` vazio sem impedir o envio.
2. O texto é limitado a mil caracteres, preservado sem reescrita automática e
   não aparece nos eventos de domínio.
3. O briefing é material de preparação e nunca é incorporado automaticamente
   ao prontuário SOAP.
4. Humor muito baixo ou risco proveniente de instrumento validado exige revisão
   humana; não produz diagnóstico, conduta ou mensagem automática.
5. Pacientes só enviam o próprio check-in. Profissionais precisam estar
   atribuídos ao paciente para revisar o conteúdo.
6. Escritas usam versão otimista, chave de idempotência e eventos de outbox.

`InMemoryPreSessionCheckInRepository` permite validar o workflow antes da
persistência. Um futuro adaptador Firestore deverá implementar
`PreSessionCheckInRepository` sem alterar o domínio.

---

## Linha do tempo clínica e memória verificável

O módulo `packages/core/src/clinicalTimeline` é uma projeção de leitura
reconstruível. Ele não substitui prontuário, avaliação, plano terapêutico ou
agenda: reúne referências para essas fontes em ordem longitudinal.

```mermaid
flowchart LR
    RECORD["Prontuário aprovado"] --> PROJECTOR["Projetores tipados"]
    ASSESS["Escalas"] --> PROJECTOR
    CARE["Humor, hábitos, tarefas e metas"] --> PROJECTOR
    PRE["Check-in pré-sessão"] --> PROJECTOR
    EVENTS["Sessões, agenda e alertas"] --> PROJECTOR
    PROJECTOR --> TIMELINE["ClinicalTimelineEntry"]
    TIMELINE --> SEARCH["Busca evidence_only"]
    SEARCH --> SOURCES["Trechos + referências verificáveis"]
```

Cada entrada mantém:

- organização, paciente e profissionais autorizados;
- categoria, data e importância;
- trecho de evidência quando necessário;
- tipo, ID, versão, revisão e campo da fonte;
- hash SHA-256 quando a origem é uma revisão aprovada do prontuário.

### Garantias

1. Rascunhos de prontuário não entram na linha do tempo; apenas revisões
   aprovadas podem ser projetadas.
2. A busca atual é determinística e retorna `mode: evidence_only`. Ela não
   redige uma resposta clínica nem completa lacunas.
3. Consultas exigem `clinical_records.read`, vínculo do profissional com o
   paciente e auditoria sem armazenar o texto pesquisado.
4. A projeção pode ser refeita de forma idempotente a partir das fontes.
5. Trechos clínicos continuam sensíveis. O adaptador real deverá protegê-los em
   repouso e manter as mesmas regras de acesso do prontuário.
6. Um futuro copiloto somente poderá responder usando as entradas recuperadas e
   deverá citar cada fonte utilizada.

`InMemoryClinicalTimelineRepository` valida filtros e reconstrução antes do
Firestore. O futuro adaptador não será fonte de verdade: prontuário, avaliações,
care plan e eventos permanecem autoritativos.

---

## Comunicação e notificações

O módulo `packages/core/src/communication` normaliza mensagens transacionais
de agenda, tarefas e financeiro antes que qualquer provedor seja chamado.

1. Canal e categoria respeitam preferências e o consentimento mais recente do
   paciente.
2. Templates tipados impedem inclusão de SOAP, diagnóstico, conteúdo de risco
   ou notas clínicas.
3. A fila usa chave de idempotência, agendamento, limite de tentativas e estados
   `queued`, `sending`, `delivered`, `failed` e `cancelled`.
4. Auditoria registra categoria, canal, tentativa e resultado, nunca o corpo da
   mensagem ou o contato do paciente.
5. `NotificationDeliveryPort` permite adaptadores independentes para Evolution
   API, Expo Push e e-mail.
6. Credenciais e contatos reais pertencem somente aos adaptadores de servidor.

`InMemoryNotificationRepository` e `InMemoryCommunicationAudit` validam o
workflow sem infraestrutura. O cliente legado da Evolution não aceita mais
credencial padrão nem registra número ou texto em logs.

---

## Camada de aplicação local

`apps/web/src/server/application` coordena os módulos do core no servidor
Next.js. Route Handlers expõem a fronteira necessária ao app mobile e às
futuras integrações, enquanto regras clínicas e financeiras continuam no core.

O primeiro fluxo vertical executável é:

`contexto → autorização → agendamento → conflito → persistência → lembrete`

O segundo fluxo vertical é a automação pós-sessão em 1 clique, que atravessa
quase todos os módulos em uma única cadeia transacional:

```mermaid
flowchart LR
    REVIEW["Conteúdo revisado"] --> SCREEN["Triagem da entrega"]
    SCREEN --> APPROVE["Aprovação do prontuário"]
    APPROVE --> TIMELINE["Projeção na linha do tempo"]
    APPROVE --> HANDOFF["Entrega ao paciente"]
    HANDOFF --> BILLING["Cobrança"]
    BILLING --> RECEIPT["Recibo"]
    RECEIPT --> NOTIFY["Notificação"]
    NOTIFY --> DONE["Sessão concluída"]
```

O ponto sem volta é a aprovação do prontuário: depois dela, uma falha em
qualquer etapa opcional é registrada no agregado da sessão, interrompe a cadeia
e devolve resultado parcial, sem desfazer o registro clínico já aprovado. Isso
antecipa o comportamento exigido quando a persistência real substituir os
repositórios em memória — não existe transação distribuída entre prontuário,
financeiro e fila de mensagens, então a compensação é explícita e auditável.

Todas as mutações exigem `Idempotency-Key`, carregam correlação e retornam erros
padronizados. Cada etapa da cadeia deriva seu próprio `commandId` da chave da
requisição, de modo que a repetição reproduz o resultado em vez de duplicar
cobranças ou mensagens. O dashboard transversal consulta agenda, tarefas,
finanças e fila de comunicação em paralelo, sem tornar a projeção uma nova fonte
de verdade.

O hash SHA-256 do conteúdo aprovado é computado no core
(`computeSoapContentHash`), sobre uma serialização canônica da revisão SOAP.
Ele é o elo verificável entre a aprovação registrada no prontuário e cada
entrada projetada na linha do tempo.

A segurança da aplicação é garantida pela autenticação de sessão via cookies
criptografados (`viver_mais_session`), isolamento multi-tenant por `organizationId`
e políticas estritas de RBAC, garantindo conformidade com a LGPD e o CFP.

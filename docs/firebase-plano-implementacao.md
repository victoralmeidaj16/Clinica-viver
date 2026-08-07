# Plano de Implementação — Integração Firebase / Firestore (Reaproveitando Projeto do Sponteiro)

Reaproveitaremos o projeto do Firebase da plataforma **Sponteiro** para a **Clínica Viver Mais**, evitando limites de criação de novos projetos na GCP/Firebase.

## Requisitos de Isolamento & Segurança

> [!IMPORTANT]
> **Isolamento de Dados (Zero Colisão com o Sponteiro):**
> Como utilizaremos o mesmo `FIREBASE_PROJECT_ID`, todas as coleções do Firestore para a Clínica Viver Mais utilizarão o prefixo `viver_mais_` (ex: `viver_mais_patients`, `viver_mais_appointments`, `viver_mais_records`, `viver_mais_financial`).
> Dessa forma, os dados desta aplicação ficam 100% isolados dos dados do Sponteiro no mesmo projeto.

> [!TIP]
> **Variáveis de Ambiente na Vercel:**
> - `FIREBASE_PROJECT_ID`: O ID do projeto do Sponteiro (ex: `sponteiro-prod` ou similar).
> - `FIREBASE_CLIENT_EMAIL`: Email da conta de serviço.
> - `FIREBASE_PRIVATE_KEY`: Chave privada da conta de serviço.

---

## Mudanças Propostas

### Estratégia de Branches
- Criar a branch `feature/firebase-firestore` a partir da `main`.

### Dependências

#### [package.json](file:///Users/victoralmeidaj16/Downloads/Clinica%20Viver%20Mais/apps/web/package.json)
- Instalar a biblioteca `firebase-admin` no `apps/web`.

### Adaptadores do Firestore

#### [NEW] [firestore.ts](file:///Users/victoralmeidaj16/Downloads/Clinica%20Viver%20Mais/apps/web/src/server/firebase/firestore.ts)
- Inicializador do `firebase-admin` com validação de credenciais de produção.

#### [NEW] [firestoreRepository.ts](file:///Users/victoralmeidaj16/Downloads/Clinica%20Viver%20Mais/apps/web/src/server/persistence/firestore/firestoreRepository.ts)
- Implementação dos repositórios Firestore utilizando o namespace isolado `viver_mais_*`:
  - `viver_mais_patients`
  - `viver_mais_appointments`
  - `viver_mais_records`
  - `viver_mais_financial`

#### [store.ts](file:///Users/victoralmeidaj16/Downloads/Clinica%20Viver%20Mais/apps/web/src/server/application/store.ts)
- Ativar o adaptador do Firestore quando a variável `FIREBASE_PROJECT_ID` estiver presente.

---

## Plano de Validação

### Testes Automatizados
- Executar `git checkout -b feature/firebase-firestore`
- Executar `npm run typecheck`
- Executar `npm run web:build`

### Validação Manual
- Testar inserção e leitura de pacientes e consultas no Firestore com o prefixo `viver_mais_`.
- Confirmar que a branch `main` continua 100% intacta com a arquitetura OCI original.

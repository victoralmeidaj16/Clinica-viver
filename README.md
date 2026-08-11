# Thats Life (TL - Psi) 🧠

> **Plataforma de Inteligência Clínica & Automação Pós-Sessão em 1 Clique**

O **Thats Life** é um ecossistema de software de saúde mental desenvolvido para transformar a prática clínica de psicólogos e clínicas, automatizando a burocracia administrativa.

> [!IMPORTANT]
> A produção usa Vercel no frontend e MySQL em Docker na VPS Hostinger. Não
> utilize dados clínicos reais até que os controles de segurança e operação
> estejam homologados pela clínica.

---

## ⚡ Diferenciais Competitivos (vs PsicoManager, PersonCare e SimplePractice)

1. **Automação Pós-Sessão em 1 Clique:**
   * Síntese pós-sessão do psicólogo $\rightarrow$ Rascunho de Prontuário SOAP por IA $\rightarrow$ Edição e validação humana $\rightarrow$ Envio de recibo/cobrança.
   * O psicólogo insere a síntese clínica e a IA gera a minuta do SOAP com campos totalmente editáveis antes de salvar no prontuário oficial.
   * A linha do tempo clínica reúne evidências longitudinais com referência à fonte, permitindo memória verificável sem respostas inventadas.
2. **Evolution API Nativa:**
   * Envio automático de confirmações de agendamento, lembretes e links de cobrança Pix via WhatsApp sem depender de plataformas proprietárias infladas.
3. **Módulo de Supervisão Clínica:**
   * Anonimização automática de casos por IA para envio e avaliação por professores e supervisores em clínicas-escola e institutos.

---

## 📂 Estrutura do Monorepo

```text
TL - Psi/
├── apps/
│   └── web/               # Cockpit do Psicólogo & Gestão da Clínica (Next.js 16)
├── packages/
│   └── core/              # Regras de Negócio, IA (SOAP), Evolution API e Schemas
└── docs/                  # PRD e Especificações Técnicas
```

---

## 🚦 Como iniciar

Requisitos: Node.js 20.19.4 ou superior e npm.

```bash
npm install
cp .env.example .env.local
npm run check
```

Para executar a aplicação web:

```bash
npm run web:dev
```

Para desenvolver contra um MySQL local real:

```bash
npm run db:up
MYSQL_ADMIN_URL=mysql://root:dev-root-local@127.0.0.1:3307/viver_mais_clinica npm run db:migrate
```

Depois, configure `DATABASE_URL`, `ORGANIZATION_ID` e as variáveis de sessão no
`.env.local`. Sem `DATABASE_URL`, a aplicação continua no modo demonstração.

---

## Verificações

- `npm run lint`: lint da aplicação web.
- `npm run typecheck`: TypeScript do core e web.
- `npm test`: testes unitários do domínio clínico.
- `npm run web:build`: build de produção do Next.js.
- `npm run check`: executa todas as verificações acima.

---

## Produção com MySQL na VPS Hostinger

O MySQL e o backend rodam na mesma rede Docker privada na VPS. A porta do banco
não é exposta; somente o container web a acessa. O fluxo de atualização é:

```bash
npm ci
MYSQL_ADMIN_URL="$MYSQL_ADMIN_URL" npm run db:migrate
npm run check
npm run web:build
npm run start --workspace @thats-life/web
```

Credenciais administrativas são usadas somente pelo runner de migrations; a
aplicação opera com um usuário restrito a DML. Veja
[`docs/hostinger-vps.md`](./docs/hostinger-vps.md) para o roteiro vigente.

## Vercel + backend permanente

O projeto `clinica-viver-web` continua sendo publicado a partir da **raiz deste
monorepo**, usando o [`vercel.json`](./vercel.json) da raiz. `BACKEND_ORIGIN`
encaminha somente as APIs persistentes para `app.clinicavivermais.cloud`; as
páginas e assets continuam sendo servidos pela Vercel.

```bash
npm run typecheck
npm run web:build
git push origin main
npx vercel inspect https://clinica-viver-web.vercel.app --wait --timeout 3m
```

> [!WARNING]
> A aplicação da Vercel deve servir o Next.js deste repositório diretamente.
> Não adicione um `rewrite` global de `/:path*` para
> `app.clinicavivermais.cloud` em `next.config.mjs` ou `vercel.json`.
> Esse proxy faz o deploy terminar com sucesso, mas mantém o domínio exibindo
> a versão antiga hospedada no servidor externo.

Se um deploy estiver como `Ready`, mas o site continuar antigo, consulte o
[guia de deploy e diagnóstico da Vercel](./docs/vercel-setup-guia.md).

> O material OCI foi mantido em [`docs/oci-migracao.md`](./docs/oci-migracao.md)
> exclusivamente como histórico; ele não descreve a produção atual.

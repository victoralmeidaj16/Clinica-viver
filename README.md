# Thats Life (TL - Psi) 🧠

> **Plataforma de Inteligência Clínica & Automação Pós-Sessão em 1 Clique**

O **Thats Life** é um ecossistema de software de saúde mental desenvolvido para transformar a prática clínica de psicólogos e clínicas, automatizando a burocracia administrativa.

> [!IMPORTANT]
> O repositório está em fase de transição de arquitetura. IA, OCI MySQL, Evolution API e pagamentos
> estão sendo unificados na base relacional OCI. Não utilize dados clínicos reais.

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

## 🚦 Como Iniciar

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

---

## Verificações

- `npm run lint`: lint da aplicação web.
- `npm run typecheck`: TypeScript do core e web.
- `npm test`: testes unitários do domínio clínico.
- `npm run web:build`: build de produção do Next.js.
- `npm run check`: executa todas as verificações acima.

---

## Deploy na Vercel

O projeto `clinica-viver-web` deve ser publicado a partir da **raiz deste
monorepo**, usando o [`vercel.json`](./vercel.json) da raiz.

```bash
npm run typecheck
npm run web:build
git push origin main
npx vercel inspect https://clinica-viver-web.vercel.app --wait --timeout 3m
```

> [!WARNING]
> A aplicação da Vercel deve servir o Next.js deste repositório diretamente.
> Não adicione um `rewrite` global de `/:path*` para
> `app.vivermaispsicologia.com.br` em `next.config.mjs` ou `vercel.json`.
> Esse proxy faz o deploy terminar com sucesso, mas mantém o domínio exibindo
> a versão antiga hospedada no servidor externo.

Se um deploy estiver como `Ready`, mas o site continuar antigo, consulte o
[guia de deploy e diagnóstico da Vercel](./docs/vercel-setup-guia.md).

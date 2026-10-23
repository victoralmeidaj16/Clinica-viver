# Guia de Configuração no Vercel — Clinica Viver Mais

Este documento contém o passo a passo para configurar e testar a plataforma no **Vercel**.

## 1. Configurações do Projeto no Vercel

Ao importar o repositório no Vercel, certifique-se das seguintes opções:

* **Git Repository:** `victoralmeidaj16/Clinica-viver`
* **Production Branch:** `main`
* **Root Directory:** raiz do repositório (`.`)
* **Framework Preset:** `Next.js`
* **Node.js Version:** `20.x`
* **Build Command:** `npm run web:build`
* **Output Directory:** `apps/web/.next`

O arquivo autoritativo para o build é o `vercel.json` da raiz. A raiz precisa
ser usada para que a Vercel enxergue os workspaces `apps/*` e `packages/*`.

### Regra crítica: não encaminhar todas as rotas

A Vercel deve executar e servir a aplicação Next.js deste repositório. Não
configure nenhuma destas regras:

```text
/:path* -> https://app.vivermaispsicologia.com.br/:path*
```

```js
async rewrites() {
  // Não adicionar um rewrite global para o servidor externo.
}
```

Um rewrite global pode deixar o deploy com status `Ready`, mas faz
`clinica-viver-web.vercel.app` exibir o código antigo do servidor externo. Se
for necessário integrar o backend da VPS, encaminhe apenas rotas de API
específicas; nunca use `/:path*`.

---

## 2. Variáveis de Ambiente (Environment Variables)

Adicione as variáveis abaixo no painel **Settings > Environment Variables** do Vercel:

### Backend permanente na VPS Hostinger

```env
BACKEND_ORIGIN=https://app.clinicavivermais.cloud
```

Essa variável encaminha somente `/api/application/*`, `/api/auth/*` e
`/api/infra/*`. As páginas e os assets continuam sendo construídos e servidos
diretamente pela Vercel.

### 🔑 Autenticação & Sessão
```env
AUTH_SESSION_SECRET=e7b4a2f8c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3
```
*(Você pode gerar uma string de 32 bytes executando no terminal: `openssl rand -hex 32`)*

Em produção não existe fallback para `Admin@123`/`Psi@123`. Antes do deploy,
configure usuários com hash forte ou ative a conta pelo fluxo de convite.

```env
AUTH_USERS_JSON=[{"email":"admin@vivermaispsicologia.com.br","userId":"usr-coordenacao","organizationId":"org-viver-mais","passwordHash":"scrypt$8192$8$1$..."}]
```

### 🛡️ Trava de Segurança do WhatsApp (Piloto)
Adicione **somente** os números reais dos membros da equipe que irão testar (formato com DDD):
```env
WHATSAPP_ALLOWED_NUMBERS=5548999999999,5548888888888
```

### 🩺 Diagnóstico e Modo
```env
NEXT_PUBLIC_DEMO_MODE=true
CRON_SECRET=a1b2c3d4e5f67890123456789abcdef0
ORGANIZATION_SLUG=viver-mais-psicologia
```

---

## 3. Modos de Persistência no Vercel

* **Sem `DATABASE_URL`:** O Vercel responde no endpoint `/api/infra/mode` com `{"persistence": "memory"}`. O aplicativo opera normalmente com dados simulados em memória, ideal para validação rápida da equipe.
* **Com `BACKEND_ORIGIN`:** A Vercel encaminha as APIs persistentes ao backend
  HTTPS da VPS, que é o único componente com acesso ao MySQL privado. Não é
  necessário nem recomendado colocar `DATABASE_URL` na Vercel.

---

## 4. Checklist de Teste da Equipe

1. [ ] Acessar `https://<seu-link>.vercel.app/api/infra/mode` e confirmar `{"persistence":"mysql"}`.
2. [ ] Testar navegação na Agenda (`/agenda`).
3. [ ] Testar Cockpit do Psicólogo (`/cockpit`).
4. [ ] Efetuar disparo de WhatsApp de teste para um número liberado no `WHATSAPP_ALLOWED_NUMBERS`.

---

## 5. Fluxo correto de publicação

Antes do push:

```bash
npm run typecheck
npm run web:build
git status --short --branch
```

Depois, publique na branch de produção:

```bash
git push origin main
```

A integração do GitHub inicia o deploy automaticamente. Acompanhe até o
status mudar para `Ready`:

```bash
npx vercel inspect https://clinica-viver-web.vercel.app --wait --timeout 3m
```

Por fim, acesse o domínio de produção e valide visualmente a funcionalidade
alterada. Um build local aprovado não substitui essa última verificação.

## 6. Diagnóstico: deploy pronto, site antigo

Siga esta ordem:

1. Confirme que o commit local e o remoto são o mesmo:

   ```bash
   git rev-parse HEAD
   git ls-remote origin refs/heads/main
   ```

2. Confirme que o domínio aponta para o deploy mais recente:

   ```bash
   npx vercel inspect https://clinica-viver-web.vercel.app
   ```

3. Procure por proxies globais acidentais:

   ```bash
   rg -n "rewrites|app\\.vivermaispsicologia\\.com\\.br|/:path\\*" \
     vercel.json apps/web/vercel.json apps/web/next.config.mjs
   ```

4. Se existir encaminhamento global para o servidor externo, remova-o, rode o
   build novamente e faça um novo commit. Limpar o cache do navegador não
   corrige esse problema.

5. Após trocar a origem que atende o domínio, pode ser necessário entrar
   novamente, pois a sessão anterior pode não ser reconhecida pela aplicação
   recém-publicada.

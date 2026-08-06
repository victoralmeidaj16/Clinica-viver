# Guia de Configuração no Vercel — Clinica Viver Mais

Este documento contém o passo a passo para configurar e testar a plataforma no **Vercel**.

## 1. Configurações do Projeto no Vercel

Ao importar o repositório no Vercel, certifique-se das seguintes opções:

* **Root Directory:** `apps/web` *(Essencial para monorepo)*
* **Framework Preset:** `Next.js`
* **Node.js Version:** `20.x`

---

## 2. Variáveis de Ambiente (Environment Variables)

Adicione as variáveis abaixo no painel **Settings > Environment Variables** do Vercel:

### 🔑 Autenticação & Sessão
```env
AUTH_SESSION_SECRET=e7b4a2f8c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3
```
*(Você pode gerar uma string de 32 bytes executando no terminal: `openssl rand -hex 32`)*

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
* **Com `DATABASE_URL`:** Requer que o MySQL privado na OCI esteja acessível (ex: via Cloudflare Tunnel ou VM da OCI).

---

## 4. Checklist de Teste da Equipe

1. [ ] Acessar `https://<seu-link>.vercel.app/api/infra/mode` e confirmar `{"persistence":"memory"}`.
2. [ ] Testar navegação na Agenda (`/agenda`).
3. [ ] Testar Cockpit do Psicólogo (`/cockpit`).
4. [ ] Testar Prontuários e Linha do Tempo (`/prontuarios`).
5. [ ] Efetuar disparo de WhatsApp de teste para um número liberado no `WHATSAPP_ALLOWED_NUMBERS`.

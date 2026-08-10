# 🤖 Guia para Agentes de IA — Thats Life (TL - Psi)

Bem-vindo ao repositório do **Thats Life (TL - Psi)**. Este repositório foi projetado com uma arquitetura limpa, focada em inteligência clínica, automação de prontuários via IA e comunicação via Evolution API.

---

## 🗺️ Estrutura de Pastas e Módulos

```text
/Clinica Viver Mais
├── apps/
│   └── web/            # Aplicação Web (Next.js 16 App Router) - Cockpit do Psicólogo & Vitrine
├── packages/
│   └── core/           # Regras puras, IA Engine (SOAP), Evolution API client, Schemas MySQL (OCI)
└── docs/               # Especificações técnicas, PRD e benchmarks
```

---

## ⚡ Regras de Ouro

1. **Eficiência de Componentes:** Componentes devem ser modulares e ter limite de tamanho (< 250 linhas).
2. **Foco no Workflow de 1 Clique:** As funcionalidades do cockpit do psicólogo devem sempre priorizar a automação de etapas pós-sessão (SOAP + tarefas + cobrança).
3. **Privacidade & Compliance:** Garantir que todo registro clínico respeite os requisitos do CFP e LGPD (criptografia em repouso e anonimização automática em supervisão).
4. **Deploy Direto na Vercel:** O projeto `clinica-viver-web` é construído pela raiz do monorepo e deve servir esta aplicação diretamente. Nunca adicionar um rewrite global de `/:path*` para `app.vivermaispsicologia.com.br`; integrações externas devem usar somente rotas específicas.

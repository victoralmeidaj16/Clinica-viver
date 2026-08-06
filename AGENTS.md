# 🤖 Guia para Agentes de IA — Thats Life (TL - Psi)

Bem-vindo ao repositório do **Thats Life (TL - Psi)**. Este repositório foi projetado com uma arquitetura limpa, focada em inteligência clínica, automação de prontuários via IA, aplicativo mobile do paciente e comunicação via Evolution API.

---

## 🗺️ Estrutura de Pastas e Módulos

```text
/TL - Psi
├── apps/
│   ├── web/            # Aplicação Web (Next.js 16 App Router) - Cockpit do Psicólogo & Clínicas
│   └── mobile/         # Aplicação Mobile (React Native / Expo) - App do Paciente
├── packages/
│   └── core/           # Regras puras, IA Engine (SOAP), Evolution API client, Schemas MySQL (OCI)
└── docs/               # Especificações técnicas, PRD e benchmarks
```

---

## ⚡ Regras de Ouro

1. **Eficiência de Componentes:** Componentes devem ser modulares e ter limite de tamanho (< 250 linhas).
2. **Foco no Workflow de 1 Clique:** As funcionalidades do cockpit do psicólogo devem sempre priorizar a automação de etapas pós-sessão (SOAP + tarefas + cobrança).
3. **Privacidade & Compliance:** Garantir que todo registro clínico respeite os requisitos do CFP e LGPD (criptografia em repouso e anonimização automática em supervisão).

# Thats Life (TL - Psi) 🧠📱

> **Plataforma de Inteligência Clínica, Automação Pós-Sessão em 1 Clique & Acompanhamento Terapêutico Mobile**

O **Thats Life** é um ecossistema de software de saúde mental desenvolvido para transformar a prática clínica de psicólogos e clínicas, automatizando a burocracia administrativa e oferecendo um acompanhamento contínuo e elegante ao paciente.

> [!IMPORTANT]
> O repositório está em fase de protótipo. IA, Firestore, Evolution API, pagamentos e
> sincronização mobile ainda são simulados. Não utilize dados clínicos reais.

---

## ⚡ Diferenciais Competitivos (vs PsicoManager, PersonCare e SimplePractice)

1. **Automação Pós-Sessão em 1 Clique:**
   * Transcrição de áudio/sessão $\rightarrow$ Rascunho de Prontuário SOAP por IA $\rightarrow$ Resumo e tarefas revisados para o app do paciente $\rightarrow$ Envio de recibo/cobrança.
   * O conteúdo destinado ao paciente possui contrato separado: nunca inclui transcrição, SOAP, hipótese diagnóstica ou notas internas.
   * A linha do tempo clínica reúne evidências longitudinais com referência à
     fonte, permitindo memória verificável sem respostas inventadas.
2. **App Mobile do Paciente (`apps/mobile`):**
   * Diário de humor diário, controle de hábitos, tarefas terapêuticas, check-in
     pré-sessão com assuntos opcionais e lembretes por notificação push.
3. **Evolution API Nativa:**
   * Envio automático de confirmações de agendamento, lembretes e links de cobrança Pix via WhatsApp sem depender de plataformas proprietárias infladas.
4. **Módulo de Supervisão Clínica:**
   * Anonimização automática de casos por IA para envio e avaliação por professores e supervisores em clínicas-escola e institutos.

---

## 📂 Estrutura do Monorepo

```text
TL - Psi/
├── apps/
│   ├── web/               # Cockpit do Psicólogo & Gestão da Clínica (Next.js 16)
│   └── mobile/            # App Mobile do Paciente (React Native / Expo)
├── packages/
│   └── core/              # Regras de Negócio, IA (SOAP), Evolution API e Schemas
└── docs/
    ├── PRD.md             # Documento de Requisitos de Produto (PRD Oficial)
    ├── ARCHITECTURE.md    # Arquitetura Técnica do Sistema
    └── BENCHMARK_COMPETITIVO.md # Estudo PsicoManager x PersonCare x SimplePractice
```

---

## 🚦 Como Iniciar

Requisitos: Node.js 20.19.4 ou superior e npm.

```bash
npm install
cp .env.example .env.local
npm run check
```

Para executar as aplicações:

```bash
npm run web:dev
npm run mobile:start
```

Consulte [`docs/PRD.md`](docs/PRD.md) e [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
para detalhes técnicos.

## Verificações

- `npm run lint`: lint da aplicação web.
- `npm run typecheck`: TypeScript do core, web e mobile.
- `npm test`: testes unitários do domínio clínico.
- O domínio financeiro testado inclui conciliação, relatórios, CSV, PDF,
  persistência em memória e contratos para Asaas/Pix/NFSe/Receita Saúde.
- O domínio de identidade inclui clínicas, membros, profissionais, pacientes,
  responsáveis, RBAC e isolamento multi-tenant sem acoplamento a provedor.
- `npm run web:build`: build de produção do Next.js.
- `npm run mobile:build`: export web do app Expo para validar o bundle.
- `npm run check`: executa todas as verificações acima.

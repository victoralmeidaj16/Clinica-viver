# Proposta de evolução — plataforma Viver Mais

Documento interno. Consolida os quatro documentos de origem — reunião com
Giuliana (05/08/2026), plano de implantação, resumo da transcrição da clínica
escola e proposta de automatização — e os confronta com o que o repositório de
fato executa hoje.

**Estado: 07/08/2026.** Cada afirmação da tabela abaixo aponta para o arquivo
que a sustenta. A regra deste documento é não declarar pronto o que não gira.

---

## 1. O que a leitura do código mostrou

A base clínica da plataforma é forte e está descrita em
`docs/FUNCIONALIDADES.md`. A camada específica da Clínica Viver Mais, porém,
estava em grande parte **na vitrine, não no motor**: telas completas sobre
dados que ninguém calculava.

| Prometido | Situação | Onde |
| :--- | :--- | :--- |
| Rodízio filtrado por turno, modalidade e serviço | ✅ **Feito em 07/08/2026** | `packages/core/src/viverMaisMatchingEngine.ts`, `server/application/viverMaisRodizio.ts` |
| SLA 24h com transbordo automático | ✅ **Feito em 07/08/2026** | `api/application/triagem/sla-sweep`, `confirmar-contato/[id]` |
| Toggle de ativar/desativar perfil no rodízio | ✅ **Feito em 07/08/2026** | `api/application/credenciamento-psicologo/[id]` |
| Disparo duplo de WhatsApp (psicólogo + paciente) | ✅ **Feito em 07/08/2026** | `server/application/viverMaisWhatsApp.ts` |
| Split 70/30 e abatimento na mensalidade | ⚠️ O split é calculado, mas **não existe ledger de crédito por aluno**. O valor exibido é texto fixo: `R$ 28.684,32` | `viverMaisAsaasService.ts`; `app/relatorios/page.tsx:162` |
| 11 indicadores do cockpit | ⚠️ Quatro são calculados; o resto são constantes — `slaPercentual: 98.2`, `348` atendimentos, `R$ 18,40/Lead`, faixa etária e origem de leads como texto | `api/application/indicadores/route.ts:32-39` |
| Gênero e faixa etária dos pacientes | ❌ O formulário da vitrine **não coleta gênero**; o indicador cai em constante | `server/application/persistence.ts:85` |
| CAC / CPA de marketing | ❌ Não há tela para lançar investimento; o número é fixo | `api/application/indicadores/route.ts:39` |
| Convênios PJ restritos à gestão | ❌ Projetos em `useState`, sem persistência e **sem restrição de papel** | `app/convenios/page.tsx:25` |
| Auditoria de desistência e reengajamento | ❌ Tela inicia vazia e sem API; o tipo `AuditoriaDesistencia` não tem consumidor | `app/retencao/page.tsx:28` |
| Fila de mensagens com consentimento e retry | ⚠️ O núcleo tem tudo; a triagem ainda envia direto, fora dela | `packages/core/src/communication/*` |
| Nome social, foto, turma, pós-graduações | ⚠️ Coletados e persistidos; **foto ainda não** | `api/application/credenciamento-psicologo/route.ts` |
| Robô de triagem no WhatsApp | ❌ Não existe | — |
| Persistência em MySQL OCI | ❌ `infra/mysql/004_clinica.sql` modela 13 tabelas; a aplicação grava em snapshot de arquivo | `server/application/persistence.ts` |

**Três achados que não estavam em documento nenhum**, encontrados ao ligar o
rodízio:

1. **A vitrine e o núcleo falavam vocabulários incompatíveis** — `VESPERTINO`
   contra `TARDE`, `SOCIAL` contra `ACESSIVEL_SOCIAL`. O filtro jamais casaria
   e a fila voltaria vazia para todos, em silêncio. Corrigido.
2. **A rota da fila não tinha autenticação alguma**: nome e telefone de quem
   procurou a clínica eram legíveis por qualquer requisição. Corrigido.
3. **A triagem disparava WhatsApp sem passar pela allowlist do piloto**,
   contornando a trava que existe justamente para isso. Corrigido.

---

## 2. Parte A — fechar o que já foi prometido

Ordenado por dependência. Os dois primeiros itens do plano original já saíram e
por isso não aparecem aqui.

### A1. Ledger de crédito do aluno (70/30)

O gargalo nº 1 da gestão, e a origem do "comprovante de abril entregue em
agosto". Modelar o crédito acumulado por profissional sobre
`packages/core/src/financial`, que já tem `transfers`, conciliação e
relatórios.

**Escopo decidido:** cálculo e exibição apenas — mostrar ao psicólogo quantos
atendimentos realizou e qual o valor a ser abatido. **Sem** abatimento efetivo
na mensalidade e **sem** vínculo com a emissão do boleto, até a equipe
financeira validar o fluxo.

### A2. Indicadores reais

Coletar gênero e data de nascimento na triagem; criar o lançamento de
investimento em marketing, para o CAC ser divisão e não constante; honrar o
filtro de modalidade que a página de relatórios já envia e a rota ignora; e
remover todo fallback chumbado da rota de indicadores. Enquanto houver
constante, o painel informa o que alguém digitou, não o que aconteceu.

### A3. Fila de mensagens única

Fazer a triagem publicar em `packages/core/src/communication` — consentimento,
dedupe durável, retry e throttle — em vez do envio direto atual. Hoje o dedupe
vive na memória do processo e some no restart.

### A4. Convênios PJ e auditoria de desistência com persistência e permissão

Convênios restritos a gestão e financeiro via
`packages/core/src/identity/authorization.ts`. Desistência com motivo
obrigatório alimentando a fila de reengajamento.

### A5. Trilha de auditoria jurídica dos agendamentos

Indicador 11 da reunião: backup auditável de solicitações e confirmações, para
resguardo da clínica.

### A6. Persistência em MySQL

O snapshot em arquivo não tem transação entre agregados nem concorrência entre
processos. `004_clinica.sql` já está modelado e validado em MySQL descartável.

---

## 3. Parte B — funcionalidades novas

Cada uma nasce de dado que a plataforma **já produz** e ninguém lê.

### B1. Radar de evasão precoce

Hoje a desistência é registrada depois de acontecer. Humor, check-in
pré-sessão, faltas e atraso de pagamento já estão na base: sinalizar risco de
abandono antes da terceira sessão, com fila de ação para a gestão. Transforma
auditoria post-mortem em retenção.

### B2. Scorecard do aluno-psicólogo, por turma

SLA de contato, taxa de retenção, volume, NPS e assiduidade em supervisão, por
profissional e **por turma**. Serve à gestão da clínica e vira instrumento de
avaliação pedagógica da pós-graduação — a ponte clínica↔acadêmico que nenhum
fornecedor externo consegue fazer, porque exige as duas bases juntas. O campo
`turmaViverMais` já é coletado.

### B3. Capacidade e ponto cego de agenda

A partir do rodízio, projetar quando a clínica ficará sem vaga por turno e
modalidade — "Avaliação Psicológica à noite: nenhum profissional com vaga" —
antes de o paciente bater na porta fechada. O dado já existe: hoje o sistema
sabe dizer `PENDENTE_ATRIBUICAO`, mas só depois que alguém tentou.

### B4. Extrato do aluno em tempo real

Painel do psicólogo com crédito acumulado e projeção de abatimento no próximo
boleto. É o incentivo que faz o registro acontecer sozinho. Depende de A1.

### B5. Robô de triagem no WhatsApp

Seção 7 do `clinica-plano-implantacao.md`, com detecção de risco avaliada
localmente, transferência humana na primeira ocorrência e CVV — nunca
dependente de serviço externo estar de pé.

### B6. Consulta pública de protocolo

O paciente acompanha o `VM-XXXXXX` e vê em que etapa está, sem ligar para a
clínica. O protocolo já é gerado e já vai na mensagem de recebimento.

### B7. Fechamento fiscal mensal

Relatório consolidado de sessões pagas por modalidade e convênio, no formato
que a contabilidade precisa para as NFs federais que a Viver Mais emite.

---

## 4. Decisão a revisitar

`docs/FUNCIONALIDADES.md:313` declara que a plataforma **deliberadamente não
faz** lista de espera nem preenchimento de horário cancelado. Numa
clínica-escola com teto por profissional e fila real — que agora existe de
verdade, com leads em `PENDENTE_ATRIBUICAO` —, essa posição precisa ser
reafirmada ou revogada explicitamente. Este documento levanta a questão; não a
decide.

---

## 5. Matriz de priorização

| Item | Impacto | Complexidade | Depende de |
| :--- | :--- | :--- | :--- |
| A1 — Ledger de crédito 70/30 | 🔥 Alto | Média | — |
| A2 — Indicadores reais | 🔥 Alto | Média | Coleta de gênero e idade |
| B4 — Extrato do aluno | 🔥 Alto | Baixa | A1 |
| A3 — Fila de mensagens única | 🟡 Médio | Média | — |
| B3 — Capacidade de agenda | 🟡 Médio | Baixa | — |
| A4 — Convênios e desistência | 🟡 Médio | Média | — |
| B1 — Radar de evasão | 🟡 Médio | Média | A2 |
| B2 — Scorecard por turma | 🟡 Médio | Média | A2 |
| A5 — Auditoria de agendamentos | 🟢 Normal | Baixa | — |
| B6 — Consulta de protocolo | 🟢 Normal | Baixa | — |
| B7 — Fechamento fiscal | 🟢 Normal | Média | A1 |
| A6 — Persistência em MySQL | 🔥 Alto | Alta | Acesso administrativo ao DB System |
| B5 — Robô de triagem | 🟢 Normal | Alta | A3 |

**Caminho recomendado:** A1 → B4 → A2. O ledger elimina o comprovante manual,
o extrato dá ao psicólogo o motivo para registrar, e só então os indicadores
passam a medir algo que a operação alimenta sozinha.

`A6` aparece com impacto alto e fora do caminho crítico de propósito: nada do
que está acima exige o MySQL para funcionar, mas tudo fica mais frágil
enquanto o estado for um arquivo.

---

## 6. Pendências do que já foi entregue

- **Agendador do SLA.** A varredura funciona sob demanda e na abertura do
  cockpit; falta um timer na VM chamando
  `POST /api/application/triagem/sla-sweep` com `x-sla-token`.
- **Faixa de valor exige passo manual** da gestão na aprovação do psicólogo. O
  cockpit avisa "cadastro incompleto", mas a edição hoje só existe via `PATCH`,
  sem formulário.
- **Upload de foto** do profissional continua pendente, embora nome social,
  turma e pós-graduação já sejam coletados e persistidos.

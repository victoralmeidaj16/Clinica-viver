# 🚀 Proposta Definitiva de Automatização — Clínica Escola (Viver Mais Psicologia)

Este documento especifica a arquitetura e os fluxos automatizados desenhados para eliminar **100% dos processos manuais** da Clínica Escola (envio manual de comprovantes, encaminhamentos por e-mail, controle em planilhas e lançamentos manuais de descontos).

---

## 🗺️ Fluxo Definitivo de Ponta a Ponta

### 📌 Passo 1: Solicitação & Triagem no Site
| Ator | Ação Realizada |
| :--- | :--- |
| **👤 Paciente** | Acessa a **aba Clínica** no site da Viver Mais |
| **📝 Formulário** | Seleciona **Modalidade** (Acessível/Particular) + **Turno** (Manhã/Tarde/Noite) |
| **📋 Cadastro** | Preenche dados pessoais, CPF e Endereço (obrigatórios para NF) |
| **⚡ Finalização** | Clica em **"Finalizar Agendamento"** |

---

### 📌 Passo 2: Fila Inteligente & Automação (Backend)
* **⚙️ Alocação:** O sistema Sponteiro busca o psicólogo da vez via Fila *Round-Robin* (filtrado por Turno e Modalidade).
* **💾 Registro:** A solicitação é salva no banco de dados com status `AGUARDANDO_CONTATO`.

---

### 📌 Passo 3: Disparo Duplo no WhatsApp (Evolution API)
```text
📲 PARA O PSICÓLOGO:
"📩 Novo Paciente! Nome: João | Fone: (51) 99999-9999 | Turno: Tarde. Favor contactar em 24h."
[ Botão/Comando: SIM, JÁ ENTREI EM CONTATO ]

📲 PARA O PACIENTE:
"📩 Olá João! Recebemos sua solicitação de agendamento na Viver Mais Psicologia.
Um de nossos psicólogos entrará em contato com você em até 24 horas para alinhar o horário da sua consulta!"
```

---

### 📌 Passo 4: Confirmação do Contato & Transbordo em 24h
* **✅ Psicólogo Confirmou (em até 24h):** Clica no botão no Zap ➔ O sistema vincula `Paciente ↔ Psicólogo` no banco de dados.
* **🔄 Psicólogo Não Confirmou (> 24h):** O sistema expira a alocação e transborda o paciente **automaticamente** para o próximo psicólogo da fila.

---

### 📌 Passo 5: Link Único de Cobrança (Ideia 1)
1. **🔗 Gerador do Link:** Ao confirmar o contato, a Evolution API responde ao psicólogo com o link exclusivo:
   `vivermais.com.br/p/PAY-89312`
2. **💬 Envio ao Paciente:** O psicólogo copia e envia este link para o paciente no WhatsApp.
3. **💳 Pagamento:** O paciente acessa o link e paga via **Pix (QrCode instantâneo)** ou **Cartão de Crédito**.

---

### 📌 Passo 6: Conciliação & Split Automático (Sem Comprovante) CONFERIR COM A EQUIPE
* **🔔 Webhook Gateway:** O banco/gateway aprova o pagamento em tempo real.
* **📲 Zap p/ Psicólogo:** *"Pagamento de João recebido com sucesso! Crédito computado."*
* **🧾 Emissão de NF:** Dispara a emissão automática de NF-e/NFS-e para o paciente.
* **📊 Split (70/30):**
  * **30%** ➔ Creditado na Receita da Clínica Viver Mais.
  * **70%** ➔ Creditado no Saldo do Aluno/Psicólogo.

---

### 📌 Passo 7: Registro de Créditos & Cockpit de Gestão
* **📊 Acúmulo de Créditos:** O sistema registra e totaliza os 70% de cada atendimento em extrato auditável no perfil do aluno. O abatimento na mensalidade ou no montante total do curso é processado manualmente pelo financeiro para contemplar alunos com planos de pagamento flexíveis.
* **🎛️ Cockpit em Tempo Real:** Tela de acompanhamento para Giuliana/Ester/Mari verem a fila, SLAs de 24h e o faturamento total da clínica.

---

## 🛠️ Detalhamento dos Componentes do Sistema

### 1. 📲 Integração WhatsApp (Evolution API)
* **Envio da Lead:** Assim que o formulário é finalizado, a API envia a notificação para o psicólogo escolhido na fila circular (*round-robin* por turno).
* **Botão de Confirmação:** O psicólogo clica em "Confirmei o contato". O banco atualiza o status para `EM_ATENDIMENTO` e associa a dupla `Paciente ↔ Psicólogo`.
* **Gerador do Link de Pagamento:** Logo após o aceite, a API responde na conversa do psicólogo com a URL única de checkout do paciente.

### 2. 💳 Checkout Transparente com Link Único (Ideia 1)
* **URL dedicada:** Cada atendimento possui seu link no formato `vivermais.com.br/p/[ID_ATENDIMENTO]`.
* **Opções de Pagamento:** O paciente abre o link e escolhe entre **Pix Copia e Cola / QrCode Dynamic** ou **Cartão de Crédito em até 12x**.
* **Zero Envio de Comprovante:** Como a URL é vinculada diretamente à transação do BD, o pagamento liquidado via gateway (Asaas / Mercado Pago) baixa a cobrança instantaneamente via **Webhook**.

### 3. 📊 Livro-Razão & Gestão de Créditos do Aluno
* O sistema mantém um livro razão (ledger) digital de créditos para cada aluno.
* **Cálculo:** `Crédito = Valor Pago x 70%`.
* **Controle Flexível:** O financeiro consulta o saldo de créditos no sistema e aplica o abatimento manualmente nos boletos ou deduz do montante final de alunos com planos de pagamento estendidos/flexíveis.

### 4. 🎛️ Painel de Controle e Gestão (Cockpit Clínica Escuela)
* **Fila de Espera:** Visualização de pacientes aguardando atribuição de psicólogo.
* **SLA de 24h:** Alertas visuais (verde/amarelo/vermelho) para monitorar quais psicólogos ainda não confirmaram contato dentro do prazo de 24 horas.
* **Métricas Financeiras:** Gráficos de receita bruta, total repassado aos alunos em desconto, e divisão por modalidade (Atendimento Acessível vs. Particular vs. Avaliação Psicológica).
* **Gestão de Convênios Empresariais:** Módulo para taguear pacientes de empresas parceiras (ex: Canguru) e direcionar cobranças diretamente para o faturamento PJ consolidado.

---

## 📊 Comparativo: Processo Antigo vs. Novo Processo Automatizado

| Etapa | Como era feito (Manual) | Como será (Automação Sponteiro) | Ganho |
| :--- | :--- | :--- | :--- |
| **Atribuição do Paciente** | Giuliana recebia e-mail e mandava WhatsApp manual | Fila inteligente por turno + disparo automático Evolution API | **100% Automático** |
| **Prazo de Contato (24h)** | Controle visual e em papel pela gestão | Timer automático com alerta e transbordo para o próximo psicólogo | **100% Automático** |
| **Cobrança do Paciente** | Psicólogo cobrava na conta pessoal ou Pix manual | Psicólogo repassa Link Único (`vivermais.com.br/p/XYZ`) | **Zero Chave Pessoal** |
| **Envio de Comprovantes** | Psicólogo tirava print e mandava em planilha/form | **FIM DO COMPROVANTE.** Baixa automática via Webhook | **Eliminado 100%** |
| **Desconto na Mensalidade** | Controle em papel ou planilhas descentralizadas | Registro auditável de créditos (70%) no sistema + aplicação manual flexível pelo financeiro (mensalidade corrente ou montante final) | **100% Auditável e Flexível** |
| **Emissão de Nota Fiscal** | Emissão manual no portal federal | Emissão automática via API integrada ao gateway | **100% Automático** |

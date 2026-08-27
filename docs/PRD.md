# PRD — Product Requirements Document: Clínica Viver Mais

**Nome do Produto:** Clínica Viver Mais  
**Data de Atualização:** Agosto de 2026  
**Status:** Especificação Oficial de Produto v2.5  
**Mercado Alvo:** Psicólogos autônomos, estudantes de pós-graduação, clínicas de saúde mental e clínicas-escola / institutos de ensino no Brasil.  

---

## 1. Visão Geral & Problema do Mercado

### 1.1 O Cenário Competitivo (PsicoManager x PersonCare x SimplePractice)
Sistemas tradicionais de gestão de consultórios e clínicas-escola sofrem de três grandes falhas estruturais:
1. **Sobrecarga Burocrática do Psicólogo:** O profissional perde tempo valioso após cada atendimento redigindo prontuários, calculando repasses e cobrando pacientes.
2. **Triagem & Distribuição Manual de Pacientes:** A gestão de clínicas-escola passa horas alocando pacientes manualmente via planilhas/WhatsApp sem controle de SLA de resposta ou transbordo automático.
3. **Desconexão Financeira & Acadêmica:** Dificuldade na conciliação de repasses com abatimento em mensalidades de pós-graduação e emissão manual e descentralizada de certificados e relatórios de estágio.

### 1.2 A Proposta de Valor da Clínica Viver Mais
A **Clínica Viver Mais** é uma **Plataforma Web Integrada de Inteligência Clínica, Gestão de Clínica-Escola & Automação via WhatsApp** que resolve essa equação com:
* **Automação Pós-Sessão em 1 Clique:** Prontuário SOAP estruturado com assinatura digital $\rightarrow$ Extração de tarefas para o paciente via WhatsApp $\rightarrow$ Disparo de cobrança Pix/cartão via Link Único.
* **Fila Inteligente & Atribuição Automática (Round-Robin):** Triagem no site por turno e modalidade com timer de SLA de 24h via Evolution API e transbordo automático para o próximo psicólogo.
* **Checkout Transparente via Link Único (`/pagar/[ID]`):** Pagamento via Pix Copia e Cola / Cartão com conciliação automática por Webhook, eliminando o envio manual de comprovantes.
* **Split de Receita 70/30 & Abatimento no Boleto de Pós:** 30% retidos pela clínica e 70% creditados para abatimento automático na mensalidade/boleto do aluno.
* **Módulo de Certificados Digitais (`/painel-certificados`):** Emissão em lote com chancela digital transparente, QR Code dinâmico e validação pública instantânea (`/validar-certificado`).
* **Cockpit de Gestão da Clínica (11 Relatórios em Tempo Real):** Dashboard completo monitorando SLAs, CPA/CAC de marketing, distribuição demográfica, volume social vs. particular e audit log de agendamentos.
* **Auditoria de Desistências & Edição Cadastral:** Registro de motivos de evasão no cadastro e rastreamento completo de alterações cadastrais para conformidade ética.

---

## 2. Requisitos Funcionais por Módulo

### 2.1 Cockpit do Psicólogo (Web - `apps/web`)
* **Abas Principais:** Leads & SLA 24h, Meus Pacientes & Status, Agenda & Atendimentos, Desconto na Mensalidade (70%) e Cockpit SOAP.
* **Prontuário SOAP Estruturado:** Editor campo a campo com versionamento imutável, aprovação por assinatura digital e hash SHA-256.
* **Painel de 1 Clique:** Aprovação do prontuário, envio de tarefas para o WhatsApp do paciente e notificação de cobrança com 1 clique.
* **Linha do Tempo Clínica Longitudinal:** Histórico unificado com busca determinística (*evidence-only*), garantindo respostas baseadas estritamente em fatos documentados.
* **Solicitação de Alteração Cadastral:** Canal para o psicólogo solicitar alteração de dados institucionais com aprovação prévia da gestão.

### 2.2 Painel de Gestão da Clínica & Clínica-Escola (Web - `apps/web`)
* **Fila Inteligente & SLA 24h:** Visualização do rodízio Round-Robin, status de contatos em tempo real e transbordo automático.
* **Gestão de Capacidade dos Psicólogos:** Controle unificado de pausa/visibilidade na vitrine e definição de limites de pacientes ativos individuais ou em massa.
* **Cockpit de 11 Relatórios:** Dashboards de SLA 24h, CPA/CAC de marketing, faixa etária/gênero, total por modalidade e audit log de agendamentos.
* **Gestão de Convênios PJ & Faturamento:** Controle de projetos corporativos com acompanhamento de faturamento e emissão de NFS-e nacional.
* **Auditoria Cadastral de Pacientes:** Histórico auditável de todas as modificações nos dados de pacientes e registro de motivos de desistência com fila de reengajamento.

### 2.3 Módulo de Certificados Digitais
* **Emissão e Gestão de Certificados:** Emissão individual ou em lote para estágios clínicos, horas complementares e eventos.
* **Dropzone de Frente e Verso:** Upload e renderização de PDF nativo em alta definição com suporte a múltiplos formatos visuais.
* **Chancela Digital & QR Code:** Carimbo transparente com assinatura institucional, código de validação único (ex: `VM-CERT-XXXX`) e QR Code dinâmico.
* **Validação Pública:** Rota aberta (`/validar-certificado`) para conferência de autenticidade em tempo real consultando o hash SHA-256 no banco de dados.

### 2.4 Integração WhatsApp (Evolution API) & Pagamentos (Asaas)
* Disparo duplo no WhatsApp para paciente e psicólogo ao alocar novo lead com perfil da demanda.
* Resposta bidirecional no próprio WhatsApp: psicólogo pode enviar `CONTATO` para confirmar primeiro atendimento ou `ENCAMINHAR` para passar o lead adiante.
* Timer de SLA de 24h com transbordo automático para o próximo profissional disponível.
* Checkout via Link Único dedicado com conciliação automática por Webhook (sem necessidade de prints de comprovantes).
* Vencimento exato e expiração automática de links de cobrança.

---

## 3. Requisitos Não-Funcionais & Compliance

* **CFP:** Guarda de prontuários com hash SHA-256 e criptografia pelo período regulatório mínimo de 5 anos.
* **LGPD:** Encriptação de dados de saúde em repouso e trânsito; isolamento multi-tenant por `organizationId` e segregação de papéis RBAC.
* **Autenticação Segura:** Sessões HTTP via cookies seguros (`viver_mais_session`), hash `scrypt` e verificação estrita no servidor.
* **Desempenho & Disponibilidade:** Frontend otimizado na Vercel e backend resiliente em VPS com MySQL 8.4 privado.

---

## 4. Diretrizes Clínicas & Éticas

* **Diagnóstico automático proibido:** Nenhum indicador vira diagnóstico ou conduta sem avaliação direta de psicólogo credenciado pelo CRP.
* **Aprovação Humana Obrigatória:** Prontuários e tarefas enviadas ao paciente exigem validação e clique explícito do profissional responsável.
* **Sigilo Estrito:** Profissionais só têm acesso aos pacientes de sua carteira; administradores não acessam o conteúdo íntimo de prontuários.

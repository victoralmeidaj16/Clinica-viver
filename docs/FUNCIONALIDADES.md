# Funcionalidades — Clínica Viver Mais

**O que é:** Plataforma integrada de inteligência clínica, gestão de atendimentos, automação de prontuários SOAP, rodízio de triagem via WhatsApp e gestão de clínica-escola para a **Viver Mais Psicologia**.

**O que resolve:** Elimina a sobrecarga burocrática pós-sessão do psicólogo, automatiza a distribuição de novos pacientes por rodízio inteligente com SLA de 24h via WhatsApp, garante a conciliação financeira com split 70/30 (abatimento na mensalidade de pós-graduação) e centraliza a emissão e validação pública de certificados digitais.

---

## 1. Atendimento e Cockpit Clínico do Psicólogo

### Cockpit Ágil do Psicólogo
- Interface limpa e responsiva desenhada para o fluxo do psicólogo no momento da consulta.
- Acesso restrito e confidencial: o profissional visualiza exclusivamente os pacientes da sua carteira (em estrita conformidade com o CFP e LGPD).
- Atalhos rápidos para agendamento de sessões, registro de histórico e visualização de atendimentos do dia.

### Prontuário SOAP Estruturado
- Registro clínico padronizado no formato SOAP:
  - **S (Subjetivo):** Queixas principais, relato espontâneo e demandas trazidas pelo paciente.
  - **O (Objetivo):** Observações clínicas, humor, linguagem corporal e apresentação do paciente.
  - **A (Avaliação):** Formulação clínica, hipóteses, evolução e intervenções realizadas.
  - **P (Plano):** Metas, tarefas para o intervalo entre consultas e planejamento da próxima sessão.
- **Versionamento Imutável & Retificações:** Cada retificação cria uma nova versão registrada com data, responsável e hash criptográfico SHA-256. Versões anteriores nunca são excluídas.
- **Auditoria de Leitura e Acesso:** Registro em log de qualquer consulta a prontuários clínicos.

### Linha do Tempo Clínica (Longitudinal)
- Histórico contínuo do paciente reunindo prontuários aprovados, escalas psicológicas, check-ins pré-sessão e marcos terapêuticos.
- **Busca Determinística (*evidence-only*):** Localização de trechos e evidências clínicas com referência exata à fonte, sem respostas inventadas ou preenchimentos por inferência.

---

## 2. Automação Pós-Sessão em 1 Clique

O diferencial de produtividade para o corpo clínico. Ao finalizar o atendimento:

1. **Revisão e Aprovação do SOAP:** O profissional revisa os campos preenchidos e aprova com assinatura digital.
2. **Extração e Envio de Tarefas:** Plano de ação e tarefas enviadas diretamente para o paciente via WhatsApp (Evolution API).
3. **Resumo Acessível ao Paciente:** Comunicação clara e acolhedora, com contrato de dados estritamente separado do prontuário técnico (bloqueia hipóteses diagnósticas e notas internas).
4. **Cobrança Automática & Recibo:** Emissão do link de pagamento (Pix Copia e Cola / Cartão de Crédito) com conciliação via Webhook.

---

## 3. Triagem, Rodízio Inteligente & WhatsApp (Evolution API)

- **Captação Automatizada:** Pacientes preenchem formulário na Vitrine (`/vitrine` ou `/agendar`) escolhendo modalidade (Social R$ 75 ou Particular R$ 130), turno (Manhã, Tarde, Noite) e serviço.
- **Rodízio Equitativo (*Round-Robin*):** Distribuição equilibrada entre psicólogos credenciados e disponíveis com base no perfil da demanda e horários.
- **Disparo Duplo & SLA de 24h:** Mensagem simultânea de confirmação para o paciente e alerta de alocação no WhatsApp do psicólogo com contador regressivo de SLA de 24 horas.
- **Resposta Ágil no Próprio WhatsApp:** O psicólogo pode responder no próprio chat (`CONTATO` para confirmar o primeiro contato ou `ENCAMINHAR` para devolver o lead à fila caso esteja impossibilitado).
- **Transbordo Automático:** Caso o profissional não confirme o contato dentro da janela de 24h, o sistema reatribui o lead automaticamente para o próximo profissional da fila.

---

## 4. Módulo de Certificados Digitais

Sistema completo de emissão, chancela digital e validação pública de certificados clínicos e acadêmicos:

- **Painel de Gestão (`/painel-certificados`):** Emissão em lote ou individual de certificados para alunos, estagiários e participantes de eventos/cursos da Viver Mais.
- **Dropzone de Arte & Verso:** Suporte a upload de frente e verso da arte institucional (PDF ou imagem de alta definição).
- **Chancela Digital & QR Code:** Carimbo com assinatura digital transparente, código de autenticação único (ex: `VM-CERT-XXXX-XXXX`) e QR Code dinâmico apontando para a URL de validação.
- **Renderização Limpa de PDF:** Geração de PDF oficial direto para download e impressão em alta definição, sem barras pretas ou artefatos de tela.
- **Validação Pública (`/validar-certificado`):** Página pública e aberta para conferência imediata da autenticidade do documento por meio do código ou QR Code, verificando o hash SHA-256 persistido no banco de dados.

---

## 5. Gestão Financeira, Split 70/30 & NFS-e

- **Checkout Transparente via Link Único (`/pagar/[ID]`):** O paciente efetua o pagamento via Pix Copia e Cola / QR Code dinâmico ou cartão com conciliação automática, eliminando o envio manual de comprovantes.
- **Split 70/30 da Clínica-Escola:**
  - **30%:** Retidos para a receita operacional da Clínica Viver Mais.
  - **70%:** Creditados na conta/extrato do psicólogo/aluno (`/meu-financeiro`).
- **Registro e Acúmulo de Créditos no Extrato (`/meu-financeiro`):** O sistema registra e totaliza os créditos acumulados de 70% de cada atendimento para controle do aluno e da instituição. O abatimento financeiro das mensalidades ou do montante do curso é processado manualmente pelo setor financeiro da instituição, acomodando planos de pagamento flexíveis e estendidos (onde o crédito é abatido do montante total/parcelas finais, e não necessariamente da mensalidade corrente).
- **Vencimento Exato & Expiração de Cobranças:** Cobranças com data de vencimento configurável e expiração automática no gateway (Asaas).
- **Emissão de NFS-e Nacional:** Emissão e faturamento automatizado de notas fiscais de serviço eletrônicas.
- **Gestão de Convênios PJ & Projetos Corporativos (`/convenios`):** Controle de pacotes de sessões para empresas parceiras, datas de emissão de NF corporativa e faturamento consolidado.

---

## 6. Painel de Gestão da Clínica & 11 Indicadores

Dashboard central para diretoria, coordenação pedagógica e recepção:

- **11 Indicadores Operacionais e Financeiros (`/relatorios`):**
  1. *Fila de Espera:* Posição dos profissionais no rodízio de distribuição.
  2. *Cumprimento do SLA de 24h:* Monitoramento de tempo de resposta e transbordos.
  3. *Distribuição por Gênero:* Métrica demográfica dos pacientes.
  4. *Faixa Etária Predominante:* Análise de público atendido.
  5. *Origem dos Leads:* Rastreamento de canais (Instagram, Indicação, Google, Parcerias).
  6. *Total de Atendimentos:* Volume de consultas realizadas por período e profissional.
  7. *Detalhamento por Modalidade:* Proporção entre atendimentos Social e Particular.
  8. *Detalhamento por Faixa de Valor:* Receita gerada por categoria de serviço.
  9. *Custo por Paciente (CPA / CAC):* Relação entre investimento de marketing e novos pacientes.
  10. *Projetos Especiais & Convênios:* Volume e faturamento corporativo.
  11. *Audit Log de Agendamentos:* Histórico auditável de marcações, reagendamentos e cancelamentos.
- **Filtro por Período & Exportação:** Geração de balanços por intervalos de datas e exportação de relatórios em Excel/PDF.

---

## 7. Gestão de Psicólogos e Capacidade de Atendimento

- **Controle Unificado de Pausa e Visibilidade:** O administrador pode pausar o recebimento de novos leads por profissional ou ocultá-lo da vitrine pública com 1 clique.
- **Limite de Pacientes Ativos:** Definição de capacidade máxima de pacientes simultâneos por psicólogo (ajuste individual ou em massa). Profissionais que atingem o limite são pausados automaticamente no rodízio.
- **Solicitação de Alteração Cadastral:** Psicólogos podem solicitar alteração de dados definidos pela gestão (ex: abordagem, foto, horários) através de um fluxo com aprovação administrativa prévia.

---

## 8. Gestão de Pacientes, Retenção & Auditoria

- **Cadastro Completo com Auditoria (`/gestao/pacientes`):** Edição de dados cadastrais, contatos e responsáveis legais com registro detalhado de quem realizou a alteração e quando.
- **Auditoria de Desistências e Reengajamento:** Registro obrigatório do motivo da saída do paciente (financeiro, horário, insatisfação, troca de abordagem, etc.) e acompanhamento da fila de reengajamento com taxa de retorno.
- **Vínculos com Alunos/Estagiários:** Rastreamento do histórico acadêmico de estágios clínicos e relatórios de horas práticas.

---

## 9. Vitrine Pública & Agendamento Online

- **Página Institucional da Clínica (`/vitrine`):** Apresentação do corpo clínico, abordagens terapêuticas e proposta de valor.
- **Agendamento Inteligente (`/agendar`):** Fluxo com seleção de serviço (Terapia Individual, Casal, Avaliação Psicológica), turnos de preferência e cálculo de valores em conformidade com as regras da gestão.
- **Hero Customizado & Identidade Visual:** Design moderno, responsivo e alinhado à marca Viver Mais Psicologia.

---

## 10. Privacidade, Ética e Conformidade (CFP & LGPD)

- **Guarda Legal de 5 Anos:** Prontuários armazenados com criptografia em repouso e políticas de retenção estrita.
- **Controle de Acesso RBAC:** Administradores e diretores não têm acesso ao conteúdo clínico dos prontuários; psicólogos acessam apenas seus próprios pacientes.
- **Comunicação Segura:** Notificações via WhatsApp passam por filtro automático de proteção de dados sensíveis (sem exposição de diagnósticos, queixas íntimas ou PII de terceiros).

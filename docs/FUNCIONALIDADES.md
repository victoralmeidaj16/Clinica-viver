# Funcionalidades — Clínica Viver Mais

**O que é:** uma plataforma de inteligência clínica e acompanhamento terapêutico
para psicólogos autônomos, clínicas de saúde mental e clínicas-escola no Brasil.

**O que resolve:** o psicólogo perde de 10 a 20 minutos de burocracia depois de
cada atendimento, e o paciente fica desassistido entre uma sessão e outra. A
Clínica Viver Mais automatiza a papelada do pós-sessão e mantém o vínculo terapêutico
vivo no intervalo entre consultas.

> **Status:** protótipo em modo demonstração. As funcionalidades abaixo
> descrevem o produto especificado e operam sobre dados fictícios. A IA clínica
> é real; WhatsApp e pagamentos usam adaptadores que não produzem efeito no
> mundo real, por escolha. Consulte a seção final para o estado de cada área.

---

## 1. Atendimento e Sessão

### Sala de atendimento online
- Sala de vídeo integrada à plataforma, sem depender de link externo.
- Controles de microfone, câmera e compartilhamento durante a consulta.
- Cards de participantes reposicionáveis na tela.
- Aviso permanente de criptografia e conformidade com o CFP.
- Tela de consentimento antes de qualquer captura de áudio.

### Transcrição invisível
- A sessão é transcrita em segundo plano, sem elemento visual que interrompa o
  contato terapêutico.
- **Diarização com calibração:** identifica quem falou cada trecho e associa as
  falas ao profissional ou ao paciente antes da geração do rascunho clínico.
- A transcrição depende de consentimento ativo, versionado e revogável pelo
  paciente a qualquer momento.
- Também aceita importação de arquivo de mídia, para quem grava por fora.

### O áudio da sessão não é guardado
A plataforma **não mantém acervo de áudio de consultas**. A gravação existe
apenas como insumo momentâneo da transcrição:

| Artefato | Quanto tempo permanece | Por quê |
| :--- | :--- | :--- |
| Áudio da sessão | Até 72 horas | Só para reprocessar caso a transcrição falhe. Descartado em seguida. |
| Transcrição | 90 dias | Janela para o psicólogo retificar o prontuário com a fonte à mão. |
| Prontuário aprovado | 5 anos | Registro clínico exigido pelo CFP. |

O que persiste como registro clínico é o prontuário aprovado pelo profissional —
não a gravação nem a transcrição. Isso reduz drasticamente a superfície de risco:
um vazamento de banco não expõe a voz de nenhum paciente, e não existe biblioteca
de sessões gravadas a ser requisitada, invadida ou vendida.

### Copiloto clínico de IA (durante a sessão)
Painel lateral acionável pelo psicólogo, com quatro ações sob demanda:
- **Resumo parcial** — síntese do relato até aquele ponto da sessão.
- **Indicadores** — sinais de alerta e marcadores de estresse identificados.
- **Hipóteses** — apoio à formulação psicoterapêutica.
- **Intervenção** — sugestão de pergunta ou técnica para o momento.

O copiloto sugere; nunca decide nem registra nada sozinho no prontuário.

---

## 2. Automação Pós-Sessão em 1 Clique

O diferencial central do produto. Depois do atendimento, o psicólogo revisa uma
única tela e aprova. A partir daí a plataforma executa a cadeia inteira:

1. **Rascunho de prontuário SOAP** gerado por IA a partir da transcrição
   (Subjetivo, Objetivo, Avaliação, Plano), seguindo critérios éticos do CFP.
2. **Aprovação humana obrigatória** — nenhum conteúdo de IA vira registro
   clínico sem revisão e assinatura do profissional.
3. **Tarefas terapêuticas** extraídas da sessão e enviadas ao app do paciente.
4. **Resumo para o paciente** em linguagem acessível, com contrato de conteúdo
   separado do prontuário.
5. **Cobrança e recibo** disparados automaticamente.
6. **Notificação ao paciente** por WhatsApp.

**Meta de desempenho:** o processamento do áudio e a geração inicial do
rascunho SOAP devem ser concluídos em menos de 15 segundos, conforme o requisito
não funcional do produto.

### Proteções do conteúdo enviado ao paciente
O que chega ao paciente passa por uma triagem automática que **bloqueia**:
- trechos de transcrição;
- o prontuário SOAP e qualquer nota interna;
- hipóteses diagnósticas;
- conteúdo de risco;
- identificadores pessoais de terceiros.

Se qualquer etapa opcional falhar (cobrança, mensagem, recibo), o prontuário já
aprovado permanece intacto e a falha fica registrada para nova tentativa, sem
duplicar cobranças ou mensagens.

---

## 3. Prontuário Clínico

- Formato SOAP estruturado, com editor campo a campo.
- **Versionamento completo:** cada retificação cria uma nova revisão; as
  versões anteriores nunca são apagadas.
- Cada aprovação registra profissional, data, atestado de revisão e uma
  assinatura digital do conteúdo aprovado.
- Toda leitura de prontuário é auditada.
- Guarda pelo período regulatório mínimo de 5 anos exigido pelo CFP, com
  possibilidade de retenção legal estendida.
- Proprietários e administradores da clínica **não** têm acesso automático ao
  prontuário. Profissionais veem apenas pacientes atribuídos a eles.

---

## 4. Linha do Tempo Clínica

Visão longitudinal única do paciente, reunindo em ordem cronológica:
- prontuários aprovados;
- resultados de escalas e testes;
- registros de humor, hábitos, tarefas e metas;
- check-ins pré-sessão;
- sessões, agendamentos e alertas.

### Busca de memória clínica
- Busca por evidência dentro do histórico do paciente.
- Cada resultado vem com o trecho de origem e a referência verificável à fonte.
- Quando não há evidência suficiente, o sistema **declara que não encontrou** em
  vez de completar a resposta por inferência.
- Rascunhos não aprovados nunca aparecem na linha do tempo.

---

## 5. Avaliação Psicológica

- **Biblioteca com 44 instrumentos** catalogados, cobrindo 17 domínios:
  ansiedade, depressão, estresse, sono, TDAH, autismo, TOC, trauma, humor,
  burnout, personalidade, cognição, alimentação, substâncias, qualidade de
  vida, funcionamento geral e risco de suicídio.
  Inclui BAI, GAD-7, BDI-II, PHQ-9, DASS-21, PSQI, ISI, ASRS, Y-BOCS, MBI,
  WHOQOL-BREF, entre outros.
- Marcação de instrumentos recomendados para TCC.
- Distinção entre autorrelato pré-sessão, aplicação pelo profissional e
  entrevista diagnóstica.
- **Envio de escalas ao paciente** com resposta pelo app.
- **Gráfico longitudinal** de evolução dos escores ao longo do tratamento.
- **Interpretação clínica assistida por IA** dos resultados.
- **Alerta de risco clínico** destacado quando um instrumento validado aponta
  indicador crítico — sempre encaminhado para revisão humana, nunca gerando
  diagnóstico ou mensagem automática.

---

## 6. Plano Terapêutico e Acompanhamento

- Definição de metas terapêuticas por paciente.
- Criação e acompanhamento de tarefas entre sessões.
- Configuração de hábitos a serem monitorados pelo paciente.
- Painel de acompanhamento do progresso.
- Alerta operacional automático quando o humor registrado fica muito baixo,
  encaminhado para revisão humana.

### Painel operacional do psicólogo
- Visão consolidada da agenda e dos atendimentos confirmados.
- Quantidade de planos terapêuticos ativos e tarefas pendentes.
- Alertas de risco provenientes dos check-ins pré-sessão.
- Resumo financeiro e quantidade de comunicações aguardando envio.

---

## 7. Check-in Pré-Sessão

- Formulário enviado ao paciente antes da consulta.
- Indicadores estruturados de estado + escala validada.
- Campo opcional para **assuntos que o paciente quer abordar** (até mil
  caracteres, preservados exatamente como escritos, sem reescrita automática).
- **Briefing pré-sessão** apresentado ao psicólogo antes do atendimento.
- O check-in é material de preparação e nunca entra automaticamente no
  prontuário.
- Indicadores de risco exigem revisão humana antes de qualquer conduta.

---

## 8. Agenda e Fila Inteligente de Atribuição

- Agendamento por paciente e profissional, com validação de conflito de
  horários.
- **Fila Inteligente de Atribuição (Round-Robin):** triagem no site por modalidade (Acessível/Social vs. Particular) e turno (Manhã/Tarde/Noite), direcionando automaticamente o paciente para o psicólogo da vez na fila circular.
- **Disparo Duplo & SLA de 24h (Evolution API):** notificação simultânea ao paciente e ao psicólogo via WhatsApp. Timer de 24 horas para o psicólogo confirmar o contato.
- **Transbordo Automático:** caso o psicólogo não confirme o contato em até 24h, o paciente é reatribuído automaticamente ao próximo psicólogo da fila de espera.
- Atendimentos presenciais, por videochamada ou por telefone.
- Confirmação, reagendamento e cancelamento pelo painel da agenda.
- Lembretes automáticos 24h e 2h antes da consulta, por WhatsApp.
- **Google Calendar:** sincronização individual de agenda por profissional.

---

## 9. Financeiro, Split 70/30 & Checkout Transparente

- **Checkout Transparente via Link Único (`vivermais.com.br/p/[ID]`):** o paciente realiza o pagamento via Pix Copia e Cola / QRCode Dinâmico ou Cartão de Crédito sem necessidade de enviar print de comprovante.
- **Conciliação 100% Automática por Webhook:** baixa instantânea no sistema assim que o gateway (Asaas/Mercado Pago) liquida a transação.
- **Split de Receita 70/30 (Clínica-Escola):**
  - **30%:** retidos para a receita operacional da Clínica Viver Mais.
  - **70%:** creditados como saldo de desconto para o aluno/psicólogo.
- **Abatimento Automático no Boleto da Pós-Graduação:** o saldo acumulado pelo aluno nos atendimentos da clínica-escola é deduzido automaticamente na emissão do boleto da sua mensalidade.
- **Módulo de Convênios Empresariais & Projetos PJ:** gestão restrita à administração financeira para tagueamento de pacotes corporativos (ex: projetos de 6 sessões), registro de data de emissão de NF e controle de vencimento de boletos corporativos.
- **NFSe e Receita Saúde** para obrigações fiscais brasileiras.

---

## 10. App Mobile do Paciente

- **Diário de humor** com registro visual diário e gráficos de tendência.
- **Central de tarefas terapêuticas** enviadas automaticamente da sessão.
- **Rastreamento de hábitos e metas** configurados pelo psicólogo.
- **Resumo da última sessão** em linguagem acessível.
- **Entrada na sala de vídeo** direto pelo app.
- **Check-in pré-sessão** e resposta a escalas enviadas pelo terapeuta.
- **Notificações push** de hábitos e proximidade da consulta.

---

## 11. Comunicação e Notificações

Central multicanal para mensagens transacionais por **WhatsApp, push e e-mail**:
- confirmação de agendamento e aviso duplo de solicitação (paciente + psicólogo);
- cobrança via Link Único dedicado e confirmação de pagamento por Webhook;
- lembretes de consulta (24h e 2h antes);
- alertas de estouro de SLA de 24h com notificação de transbordo;
- atribuição de tarefas e metas terapêuticas.

**Sino do sistema (header da gestão e do psicólogo):** lista derivada do estado
real da fila e do credenciamento, sem cadastro paralelo de avisos. A gestão vê
paciente sem profissional elegível, prazo de primeiro contato em risco ou
vencido, repasses e credenciamentos aguardando análise; o psicólogo vê apenas o
que é dele — paciente atribuído com o prazo restante, paciente que saiu da sua
fila e o estado do próprio credenciamento. Só a marca de "já li" é persistida
(`clinica_notificacoes_leituras`), por usuário, de modo que o aviso continue
correto quando a situação muda e o ponto vermelho não volte a cada login.

---

## 12. Supervisão Clínica, Retenção & Cockpit da Gestão

- **Anonimização Inteligente por IA:** remove dados pessoais identificáveis para submissão do relato clínico ao painel do supervisor em pós-graduações.
- **Auditoria de Desistências & Retenção:** captura obrigatoriamente o motivo do cancelamento/abandono (financeiro, insatisfação, troca de abordagem) e gera fila de ação para contato de reengajamento.
- **Cockpit de Gestão da Clínica (11 Relatórios em Tempo Real):**
  1. *Fila de Espera:* posição dos psicólogos no rodízio.
  2. *SLA de 24h:* alertas visuais de contatos pendentes.
  3. *Distribuição por Gênero:* métrica demográfica de pacientes.
  4. *Faixa Etária Predominante:* mapeamento de público.
  5. *Origem dos Leads:* gráfico "Como ficou sabendo da clínica".
  6. *Total de Atendimentos Efetuados:* volume mensal geral e por psicólogo.
  7. *Detalhamento por Modalidade:* atendimentos social vs. particular.
  8. *Detalhamento por Faixa de Valor:* tabela de faixas de preço.
  9. *Custo por Paciente (CPA / CAC):* cálculo `Investimento em Mkt ÷ Leads`.
  10. *Projetos Especiais & Convênios:* volume de atendimentos PJ.
  11. *Audit Log de Agendamentos:* backup auditável para resguardo jurídico.

---

## 13. Gestão da Clínica

- Papéis e permissões (Proprietário, Diretor Clínico, Profissional, Assistente, Financeiro, Auditor).
- Cadastro de psicólogos com gestão de visibilidade (exibir/privar no site ao atingir limite de vagas, ex: 33 pacientes ativos).
- Configuração de integrações (Evolution API, Asaas, NFS-e).

---

## 14. Privacidade, Ética e Conformidade

- **CFP:** guarda de prontuários criptografados por 5 anos.
- **LGPD:** criptografia em repouso e trânsito; pseudonimização no envio de prompts para IA.
- **Áudio não é acervo:** expurgo do áudio em 72h e transcrição em 90 dias.

---

## 15. O que a plataforma deliberadamente **não** faz

- **Diagnóstico automático.** Nenhum indicador de risco vira diagnóstico sem revisão humana.
- **Resposta inventada sobre o histórico.** Sem evidência, o sistema informa que não encontrou.
- **Dispensa de aprovação humana.** O prontuário SOAP e as tarefas para o paciente exigem sempre clique explícito de aprovação do profissional.

---

## 16. Como a Clínica Viver Mais se posiciona no mercado

| | PsicoManager | PersonCare | SimplePractice | **Clínica Viver Mais** |
| :--- | :--- | :--- | :--- | :--- |
| Foco | ERP de gestão clássico | Gestão + app simples | Prontuário eletrônico EUA | **Inteligência clínica + Gestão de Clínica-Escola (1-Clique)** |
| Prontuário por IA | Rascunho manual | Transcrição simples | Transcrição de nota | **SOAP automatizado com diarização e aprovação em 1 clique** |
| Atribuição de Pacientes | Manual | Não possui | Agendamento direto | **Fila Round-Robin por Turno + SLA 24h e Transbordo Automático** |
| App do paciente | Genérico / web | Humor e hábitos | Portal básico | **App nativo (humor, hábitos, tarefas, escalas, vídeo)** |
| WhatsApp | Proprietário | Ilimitado | Não suporta | **Evolution API (Alerta duplo, SLA 24h e Checkout com filtro clínico)** |
| Repasse & Mensalidade | Repasse financeiro manual | Não possui | Não atende | **Split 70/30 com Abatimento Automático no Boleto da Pós** |
| Checkout & Cobrança | Boleto / Pix manual | Recibos | Claims EUA | **Checkout Transparente via Link Único (Zero Comprovante Manual)** |
| Cockpit & Retenção | Financeiro básico | Relatórios simples | Dashboards padrão | **Cockpit em Tempo Real (11 Relatórios, CPA de Mkt, SLAs e Auditoria de Desistências)** |

---

## 17. Estado atual de cada área

A plataforma opera em **fase de transição e implementação dos módulos da Clínica Viver Mais**:

| Área | Situação |
| :--- | :--- |
| Regras clínicas, SOAP por IA e Prontuário | Implementadas e testadas |
| Automação pós-sessão de ponta a ponta | Funcional |
| App Mobile do Paciente e Sala de Vídeo | Navegáveis |
| **Fila Inteligente & Transbordo SLA 24h** | **Especificado e em implementação** (integração Evolution API) |
| **Checkout Transparente via Link Único** | **Especificado** (integração Asaas/Webhook sem comprovante manual) |
| **Split 70/30 & Abatimento na Mensalidade** | **Especificado** (motor de crédito integrado ao faturamento de pós) |
| **Cockpit de Gestão (11 Relatórios)** | **Especificado** (dashboards de SLA, CPA de Mkt e Demografia) |
| **Auditoria de Desistências & Convênios PJ** | **Especificado** (módulos de retenção e faturamento corporativo) |


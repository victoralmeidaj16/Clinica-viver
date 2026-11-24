# Checklist de testes e evidências do PDF — 23/11/2026

Referência funcional: [análise de conformidade com o PDF](comparacao-fluxos-viver-mais-2026-11-23.md) e [checklist anterior da plataforma](checklist-testes-plataforma.md).
Roteiro voltado para **demonstrar aos responsáveis da clínica** o que foi implementado a partir da especificação de 22 páginas e anexar as capturas de tela em `testes-2026-11-23/capturas/`.

**Regra de publicação e ambiente**
- **`53f29df` / `d71b670` (publicado na Vercel e VPS em 23/11):** já rodam na clínica, dependendo apenas da conferência visual e das migrations `080`–`083`.
- **Cópia local (ainda sem commit):** precisa de commit + deploy na Vercel e na VPS antes de capturar em produção — ou ser demonstrada primeiro no servidor local (`npm run web:dev`) com contas e pacientes fictícios.
- **Dados de teste e segurança:** use exclusivamente **dados fictícios** (sem expor pacientes reais, CPFs, telefones ou prontuários nas capturas). Nunca dispare WhatsApp, Asaas ou NFS-e em produção sem combinar antes destinatário e ambiente.

**Status**
- ✅ **Conferido (tela)**: validado visualmente na vitrine publicada em 23/11/2026.
- ✅ **Testado (código)**: implementado e coberto por teste automatizado; falta gerar a captura de tela em `testes-2026-11-23/capturas/` para a apresentação.
- 🚧 **Em andamento (local)**: alterações paralelas na cópia local ainda sem consolidação final no relatório principal.
- ⏳ **Pendente**: item da especificação ainda não implementado no código.
- 📝 **Decisão clínica**: depende de confirmação de regra pela equipe da clínica antes de implementar.

---

## Resumo

| Área | ✅ Tela | ✅ Código | 🚧 Local | ⏳ Pendente | 📝 Decisão |
| --- | :---: | :---: | :---: | :---: | :---: |
| 1. Site, vitrine, cursos e cadastro (`CAD`) | 1 | 3 | 0 | 1 | 0 |
| 2. Triagem, rodízio, vínculo e capacidade (`ROD`) | 0 | 12 | 0 | 1 | 0 |
| 3. Agenda, sessões, prontuário e estágio (`AGD`) | 0 | 6 | 1 | 0 | 0 |
| 4. Financeiro, convênios, créditos e Gestão (`FIN`) | 0 | 6 | 2 | 1 | 0 |
| 5. Decisões abertas com a clínica (`DEC`) | 0 | 0 | 0 | 0 | 6 |
| **Total (40 grupos de critérios)** | **1** | **27** | **3** | **3** | **6** |

---

## 1. Site, Vitrine, Cursos e Cadastro Profissional

| ID | Requisito do PDF | Origem / Versão | Status | O que comprovar na tela e captura esperada |
| --- | --- | --- | --- | --- |
| CAD-01 | Orientação Vocacional e Orientação Profissional separadas na vitrine, cadastro e rodízio (§ 14 / p. 22) | `53f29df` · [opções](../apps/web/src/lib/orientacaoVocacionalProfissional.test.ts) | ✅ Conferido (tela) | Conferido às 17h04 e 18h56 em `clinicavivermais.cloud/vitrine` e Vercel com os dois botões distintos. Captura: `01_vitrine_vocacional_profissional.png`. |
| CAD-02 | Catálogo com os 17 cursos do PDF e soma de serviços/públicos na 2ª pós-graduação (§§ 2.01–2.02 e 14) | Local · [regras](../apps/web/src/components/forms/opcoesPsicologo.ts) · [testes](../apps/web/src/components/forms/opcoesPsicologo.test.ts) | ✅ Testado (código) | Selecionar uma pós restrita/avaliação + 2ª pós ampla (incluindo *Inovações* e *Psicopatologia e Neurodivergências*) e mostrar a união das opções. Captura: `02_cadastro_17_cursos_duas_pos.png`. |
| CAD-03 | Download do PDF do Termo de Adesão pelo próprio psicólogo autenticado (§§ 3.7 e 12.05) | Local · [rota](../apps/web/src/app/api/application/credenciamento-psicologo/%5Bid%5D/comprovante-termo/route.ts) · [card](../apps/web/src/components/meu-cadastro/CardTermoAdesao.tsx) | ✅ Testado (código) | Abrir `/meu-cadastro` logado como psicólogo, exibir o card do Termo aceito com data/versão/SHA-256 e baixar o PDF. Captura: `03_psi_meu_cadastro_termo_pdf.png`. |
| CAD-04 | Envio do comprovante definitivo do Termo por e-mail somente após aprovação (§§ 3.7 e 12.05) | Local · [inscrição](../apps/web/src/app/api/application/credenciamento-psicologo/route.ts) · [e-mail](../apps/web/src/server/application/termoAdesaoComprovanteEmail.ts) · [convite](../apps/web/src/server/application/psychologistInvitation.ts) | ✅ Testado (código) | Na ficha do psicólogo `EM_ANALISE` na Gestão, mostrar `"envio liberado após aprovação"` e botão desabilitado; após aprovar, enviar via do profissional e da clínica. Captura: `04_gestao_termo_aguardando_aprovacao.png`. |
| CAD-05 | Prazo de 3 meses após encerramento da turma (mantendo outra pós válida), turmas/cursos/demandas editáveis pela Gestão e aprovação por vínculo (§§ 1.01–1.05, 2.01–2.02, 3.2, 3.4, 3.10) | Pendente · [turmas](../apps/web/src/lib/turmaEncerrada.ts) · [demandas](../apps/web/src/components/forms/necessidades.tsx) | ⏳ Pendente | Hoje encerrar turma retira na hora; listas de turmas, permissões de curso e demandas estão fixas no código. |

---

## 2. Triagem, Rodízio, Vínculo Direto e Capacidade

| ID | Requisito do PDF | Origem / Versão | Status | O que comprovar na tela e captura esperada |
| --- | --- | --- | --- | --- |
| ROD-01 | Ordem do rodízio: menos pacientes ativos → mais tempo sem receber → sorteio só no empate absoluto (§ 5.01) | `53f29df` · [motor](../packages/core/src/viverMaisCore.test.ts) · [posição](../apps/web/src/server/application/gestaoRodizio.test.ts) | ✅ Testado (código) | Abrir Gestão → Psicólogos / Cockpit e mostrar a fila numerada com a nota `"empate, decidido por sorteio"` quando houver empate absoluto. Captura: `05_gestao_cockpit_rodizio_empate.png`. |
| ROD-02 | Escolha direta: indisponibilidade, recusa ou 24h sem resposta vão à Gestão + botão "Devolver ao rodízio" (§§ 4.05, 5.04–5.05, 6.07; p. 22) | `53f29df` · [testes](../apps/web/src/server/application/viverMaisRodizio.escolhaDireta.test.ts) · [devolver](../apps/web/src/app/api/application/triagem/%5Bid%5D/devolver-rodizio/route.test.ts) | ✅ Testado (código) | No Cockpit/Sino da Gestão, mostrar pedido direcionado recusado/expirado sem transbordo automático e o botão **"Devolver ao rodízio"**. Captura: `06_gestao_cockpit_escolha_direta_devolver.png`. |
| ROD-03 | Aceite ocupa vaga imediatamente (sem redistribuir em 24h), oferta vencida é recusada e link encerra após desistência/alta (§§ 3.11, 5.03, 5.05, 12.03) | `53f29df` + Local · [aceite](../apps/web/src/server/application/viverMaisRodizio.aceite.test.ts) · [decisão](../apps/web/src/app/api/application/triagem/%5Bid%5D/decisao/route.test.ts) | ✅ Testado (código) | Mostrar selo `"Aceito"` no Cockpit e o contador do psicólogo atualizado após "Quero o paciente". Captura: `07_gestao_cockpit_selo_aceito.png`. |
| ROD-04 | Última vaga revalidada no aceite simultâneo; pedido excedente segue ao próximo compatível ou fica com a Gestão (§§ 3.11, 5.03, 6.08) | Local · [concorrência](../apps/web/src/server/persistence/captureRepository.capacidade.test.ts) · [MySQL](../apps/web/src/server/persistence/mysql/captureRepository.ts#L366) | ✅ Testado (código) | Comprovado no teste de concorrência em demonstração; validar também em homologação MySQL com duas conexões. |
| ROD-05 | Projeto Acolhe fora do limite de 5 vagas e liberação imediata de vaga na desistência/alta (§§ 6.02, 6.05–6.06; p. 22) | `53f29df` · [testes](../apps/web/src/server/application/capacidadeProjetoAcolhe.test.ts) · [migration 083](../infra/mysql/083_triagem_projeto_acolhe.sql) | ✅ Testado (código) | Abrir modal Novo Paciente mostrando a marcação **Projeto Acolhe** sem consumir vaga do limite de 5. Captura: `08_psi_novo_paciente_projeto_acolhe.png`. |
| ROD-06 | E-mail inicial da triagem omite psicólogo escolhido e não promete contato antes do aceite (§§ 4.01 e 12.01) | Local · [e-mail](../apps/web/src/server/application/triagemEmail.ts) · [testes](../apps/web/src/server/application/triagemEmail.test.ts) | ✅ Testado (código) | Demonstrado nos testes do template de recebimento após cadastro da triagem fictícia. |
| ROD-07 | Aviso de aceite ao paciente adaptado a convênio empresarial (sem cobrança individual) e preço personalizado (§§ 7.02, 9.01, 10.02, 12.01) | Local · [WhatsApp](../apps/web/src/server/application/viverMaisWhatsApp.ts#L410) · [testes](../apps/web/src/server/application/viverMaisWhatsApp.test.ts) | ✅ Testado (código) | Comprovado pelos testes unitários simulados de `avisarConfirmacaoPaciente` com pagador convênio e valor personalizado. |
| ROD-08 | Formato (`ONLINE`/`PRESENCIAL`/`INDIFERENTE`), abordagem (com alias `TCC` e 2ª pós) e duração (50/90 min) no rodízio (§§ 3.12, 4.03, 5.01) | Local · [motor](../packages/core/src/viverMaisMatchingEngine.ts) · [critérios](../apps/web/src/server/application/viverMaisRodizio.criterios.test.ts) | ✅ Testado (código) | Filtro ativo no motor, ponte do rodízio e vitrine; vitrine pública ainda precisa expor campos visuais de formato/abordagem se desejado pela clínica. |
| ROD-09 | Vínculo direto pela Gestão: escolher "Pedir aceite (24h)" vs. "Vincular diretamente", exceção de limite com justificativa ("6 de 5") e aviso ao paciente (§§ 6.07, 6.08, 12.01) | Local · [painel](../apps/web/src/components/patients/PatientReassignPanel.tsx) · [realocação](../apps/web/src/components/patients/PatientReallocationPanel.tsx) · [testes](../apps/web/src/server/application/viverMaisRodizio.gestaoDireta.test.ts) | ✅ Testado (código) | Abrir gaveta do paciente na Gestão com opções de vínculo direto/pedido de aceite e aviso de lotação com campo obrigatório de justificativa ("6 de 5"). Captura: `09_gestao_pacientes_vinculo_direto_limite.png`. |
| ROD-10 | Público homologado do psicólogo validado no cadastro manual do paciente (tela e servidor) (§§ 2.03 e 6.02) | Local · [regras](../apps/web/src/lib/patientCareOptions.ts) · [campos](../apps/web/src/components/patients/PatientRegistrationFields.tsx) · [servidor](../apps/web/src/server/application/patientDirectory.ts) · [testes](../apps/web/src/server/application/patientDirectory.test.ts) | ✅ Testado (código) | Abrir modal Novo Paciente com perfil restrito a determinados públicos e confirmar que a tela exibe somente os públicos homologados do psicólogo. Captura: `21_psi_novo_paciente_publico_homologado.png`. |
| ROD-11 | Motivo opcional na recusa de encaminhamento registrado no rodízio, enviado à coordenação e salvo em `recusas` (§ 5.04) | Local · [migration 086](../infra/mysql/086_triagem_recusas.sql) · [rodízio](../apps/web/src/server/application/viverMaisRodizio.recusa.test.ts) · [rota](../apps/web/src/app/api/application/triagem/%5Bid%5D/encaminhar/route.test.ts) | ✅ Testado (código) | Na tela `/confirmar-contato/[id]` ou `/encaminhar-contato/[id]`, preencher o campo opcional de motivo (até 300 caracteres) antes de recusar o encaminhamento. Captura: `22_recusa_encaminhamento_motivo.png`. |
| ROD-12 | Histórico administrativo por CPF reunindo solicitações sucessivas e recusas registradas na Gestão (§§ 4.02 e 6.09) | Local · [agrupamento](../apps/web/src/lib/historicoCpf.test.ts) · [painel](../apps/web/src/components/patients/PatientAdministrativeHistoryPanel.tsx) · [gaveta](../apps/web/src/components/patients/PatientManagementDrawer.tsx) | ✅ Testado (código) | Abrir a gaveta do paciente na Gestão exibindo os protocolos anteriores vinculados ao mesmo CPF e os motivos de recusa sem conteúdo clínico. Captura: `23_gestao_historico_cpf_e_recusas.png`. |
| ROD-13 | Pendências restantes de triagem/pacientes: prazo configurável (§ 5.02), lista de espera (§ 5.07), menor sem CPF pelo responsável (§ 6.03; p. 22), vínculo coletivo (§ 6.04), inativação/preferências originais (§§ 4.04, 6.05) | Pendente · [cadastro](../apps/web/src/server/application/patientDirectory.ts) | ⏳ Pendente | Itens funcionais e de regra ainda não implementados no código. |

---

## 3. Agenda, Sessões, Prontuário e Estágio

| ID | Requisito do PDF | Origem / Versão | Status | O que comprovar na tela e captura esperada |
| --- | --- | --- | --- | --- |
| AGD-01 | Aviso de 48 horas sem primeiro agendamento no sino da Gestão, mantendo o paciente ativo (§ 7.03) | `53f29df` · [testes](../apps/web/src/server/application/notificacoesAceiteSemAgendamento.test.ts) | ✅ Testado (código) | Abrir o Sino da Gestão exibindo o alerta de paciente aceito há mais de 48h sem sessão marcada. Captura: `10_gestao_sino_48h_sem_agendamento.png`. |
| AGD-02 | Orientação Parental: 50 min individual e 1h30 (90 min) para atendimento em família (§§ 7.04–7.05 e 14) | Local · [duração](../apps/web/src/lib/manualAppointment.test.ts) · [reserva](../apps/web/src/server/application/appointmentCreationCharge.test.ts) | ✅ Testado (código) | Abrir modal de agendamento manual do psicólogo selecionando Orientação Parental e exibir opções individual (50 min) e em família (1h30). Captura: `11_psi_agenda_orientacao_parental_90min.png`. |
| AGD-03 | Serviço e público da triagem levados ao link individual do paciente com filtro de horários compatíveis (§§ 2.03 e 7.01–7.05) | Local · [agenda](../apps/web/src/server/scheduling/agendaRepository.ts#L1276) · [identificação](../apps/web/src/server/scheduling/patientCpfAccess.test.ts) · [reserva](../apps/web/src/server/scheduling/publicBooking.test.ts) | ✅ Testado (código) | Abrir `/agendar/[token]` informando CPF fictício e mostrar serviço/duração aplicados nos horários livres. Captura: `12_link_publico_horarios_servico.png`. |
| AGD-04 | Correção administrativa pela Gestão de horário e formato em sessões realizadas ou canceladas + filtro por situação (§§ 7.07 e 13.01) | Local · [tela](../apps/web/src/app/gestao/agenda/page.tsx) · [testes](../apps/web/src/server/scheduling/agendaEdicaoStatus.test.ts) | ✅ Testado (código) | Abrir `/gestao/agenda`, filtrar por `Realizada`/`Cancelada` e abrir modal **Editar Atendimento** preservando situação e pagador. Captura: `13_gestao_agenda_filtro_correcao.png`. |
| AGD-05 | Sigilo na troca de psicólogo + consulta e complementos da autora em vínculos encerrados (§§ 6.09, 8.05 e 13.03) | Local · [regra](../packages/core/src/clinicalTimeline/authorizedQueries.ts) · [testes sigilo](../packages/core/src/clinicalTimeline/clinicalTimelineSigilo.test.ts) · [autoria](../packages/core/src/clinicalTimeline/clinicalTimelineAutoria.test.ts) | ✅ Testado (código) | Mostrar no seletor da Linha do Tempo / Meus Pacientes o vínculo encerrado permitindo apenas leitura dos próprios registros e adição de complemento datado. Captura: `14_psi_prontuario_vinculos_encerrados.png`. |
| AGD-06 | Rascunho e lista de registros presos à ficha ativa do paciente ao alternar fichas (§ 8.04) | Local · [regras](../apps/web/src/components/timeline/fichaAtiva.test.ts) · [formulário](../apps/web/src/components/timeline/ManualRecordForm.test.tsx) | ✅ Testado (código) | Iniciar texto em um paciente, alternar para outro na Linha do Tempo e exibir o aviso de rascunho vinculado à ficha original. Captura: `15_psi_prontuario_rascunho_ficha.png`. |
| AGD-07 | Declaração de horas filtrada por período e público salvo no agendamento (§§ 7.04, 8.03 e 8.06) | Cópia local paralela · [filtro](../apps/web/src/components/declaracao/FiltroPeriodoDeclaracao.tsx) · [migration 085](../infra/mysql/085_publico_agendamento.sql) | 🚧 Em andamento (local) | Abrir `/relatorios/declaracao` com o filtro de data inicial/final aplicado na prévia e emissão. Captura: `16_relatorios_declaracao_periodo.png`. |

---

## 4. Financeiro, Convênios, Créditos Educacionais e Gestão

| ID | Requisito do PDF | Origem / Versão | Status | O que comprovar na tela e captura esperada |
| --- | --- | --- | --- | --- |
| FIN-01 | Créditos de 70% somados por recebimento e conciliados entre Gestão, Meu Financeiro e CSV (§§ 9.04 e 11.01) | Local · [relatórios](../apps/web/src/server/application/financialReportsPeriod.test.ts) | ✅ Testado (código) | Comparar total do card de créditos na Gestão e em `/meu-financeiro` (inclusive no CSV exportado). Captura: `17_gestao_e_psi_financeiro_conciliacao.png`. |
| FIN-02 | Crédito de convênio no mês da confirmação da sessão + estorno sem reversão automática do crédito (§§ 9.07, 10.07, 11.04 e 11.07) | Local · [regras](../packages/core/src/financial/educationalCredits.ts) · [conciliação](../apps/web/src/server/application/financialReportsPeriod.test.ts) | ✅ Testado (código) | Linha no extrato com origem `"Convênio (sessão confirmada)"`; após estorno simulado, caixa reduz e crédito original permanece visível. |
| FIN-03 | Parcelas acumuladas do Asaas preservadas por competência sem sobrescrever meses anteriores (§§ 9.04, 11.02 e 11.07) | Local · [rateio](../apps/web/src/server/payments/paymentSettlement.ts) · [testes](../apps/web/src/server/payments/paymentSettlement.test.ts) | ✅ Testado (código) | Comprovado via testes unitários (`paymentSettlement.test.ts`) registrando incrementos líquidos com sufixo por parcela. |
| FIN-04 | Identificação da sessão (serviço + data/hora) ou pacote no extrato do psicólogo e CSV (§§ 11.05–11.06) | Local · [serviço](../apps/web/src/server/application/financialService.ts) · [tela](../apps/web/src/app/meu-financeiro/page.tsx) | ✅ Testado (código) | Abrir `/meu-financeiro` exibindo a coluna **Atendimento / Origem** com serviço e data/hora da sessão ou título do pacote. Captura: `18_psi_meu_financeiro_origem_sessao.png`. |
| FIN-05 | Aviso no sino do psicólogo para cobrança vencida (`overdue`) com foco direto na linha da tabela (§§ 9.05 e 12.01) | Local · [notificações](../apps/web/src/server/application/notificacoesDaSessao.ts) · [tabela](../apps/web/src/components/financial/MyReceivablesTable.tsx) · [testes](../apps/web/src/server/application/notificacoesDestino.test.ts) | ✅ Testado (código) | Abrir sino do psicólogo com aviso de cobrança vencida e clicar para destacar a linha correspondente em `/meu-financeiro`. Captura: `19_psi_sino_cobranca_vencida.png`. |
| FIN-06 | Perfil Financeiro com login próprio isolado do prontuário clínico e das rotas exclusivas da Gestão (p. 22) | Cópia local paralela · [proxy test](../apps/web/src/proxy.financeiro.test.ts) · [convênio perm](../apps/web/src/server/application/convenioPermissao.test.ts) | 🚧 Em andamento (local) | Logar com conta `billing` / `financeiro` mostrando acesso apenas ao Financeiro, Convênios e Ajuda. Captura: `20_financeiro_menu_isolado.png`. |
| FIN-07 | Valor individual previsto no contrato do convênio para cálculo de crédito (§§ 10.01, 10.07 e 11.04) | Cópia local paralela · [migration 084](../infra/mysql/084_valor_sessao_convenio.sql) · [testes](../apps/web/src/server/payments/convenioChargeTransfer.test.ts) | 🚧 Em andamento (local) | Em homologação local; `convenioChargeTransfer.test.ts` saneado e aprovado na suíte completa. |
| FIN-08 | Ocultar a ação **“Ver fatura / pagar”** ao reabrir a agenda para sessão custeada pela empresa (§ 10.02) | Local · [tela agenda](../apps/web/src/app/agendar/%5Btoken%5D/page.tsx#L425) · [testes agenda](../apps/web/src/server/scheduling/publicBooking.test.ts) | ✅ Testado (código) | Reabrir `/agendar/[token]` em atendimento com `custeado = 1` confirmando que nenhum botão ou link de pagamento individual é exibido. |
| FIN-09 | Demais itens pendentes do PDF: pacote antecipado (§§ 9.06, 11.03), vencimento parcial e confirmação bancária (§ 9.03), comando de decisão no estorno (§§ 9.07, 11.07), demais políticas por convênio (§§ 10.03–10.05), chave única de crédito (§ 11.07), editor/painel de mensagens (§§ 12.01–12.04), auditoria antes/depois (§ 13.02), relatórios Excel/PDF e painel inicial (§§ 11.06, 13.04–13.06) | Pendente · [vencimento](../apps/web/src/server/payments/sessionChargeDuePlan.ts) · [falta convênio](../apps/web/src/server/scheduling/agendaFalta.ts) | ⏳ Pendente | Itens ainda não implementados ou dependentes das decisões da seção 5. |

---

## 5. Decisões abertas com a clínica (para alinhamento na reunião)

| ID | Ponto do PDF em aberto | Situação atual no código | Pergunta objetiva para a clínica | Status |
| --- | --- | --- | --- | --- |
| DEC-01 | Horas de estágio (§ 8.03) | 1 sessão confirmada = 1h fixa | Contar **duração real** (50/90 min = 2h20 em duas sessões) ou manter **1h fixa por sessão**? | 📝 Decisão clínica |
| DEC-02 | Perinatal e Parentalidade (§ 14) | Está no grupo **restrito** | Manter no grupo restrito ou mover para o **conjunto B** (permissões amplas)? | 📝 Decisão clínica |
| DEC-03 | "Orientação Vocacional e Profissional" | Habilita os dois serviços separados | Apenas manter os 2 serviços separados ou criar também um **3º serviço combinado**? | 📝 Decisão clínica |
| DEC-04 | "Você já chamou este paciente?" (§ 12.03) | Opcional após o aceite | Manter o registro de confirmação de contato ou remover essa etapa? | 📝 Decisão clínica |
| DEC-05 | Formato Excel (§§ 11.06 e 13.05) | Exporta em **CSV** e PDF | CSV atende para o Excel da clínica ou é obrigatório arquivo **`.xlsx`**? | 📝 Decisão clínica |
| DEC-06 | Segundo marco de 3 meses (§ 1) | Só há encerramento da turma | Como funciona o segundo desligamento citado "3 meses após a saída da vitrine" e o que ele bloqueia? | 📝 Decisão clínica |

---

## 6. Verificação automatizada (cópia local em 23/11/2026)

| ID | Etapa | Comando executado | Resultado observado |
| --- | --- | --- | --- |
| AUTO-01 | Lint (`eslint`) | `npm run lint` | ✅ Concluído com **0 erros** e **43 avisos** preexistentes (0 avisos novos). |
| AUTO-02 | Checagem de tipos (`tsc`) | `npm run typecheck` | ✅ Concluído sem erros em `@thats-life/core` e `@thats-life/web`. |
| AUTO-03 | Testes do domínio | `npm run test --workspace @thats-life/core` | ✅ **225 de 225** aprovados em 28 arquivos (inclui critérios de formato/abordagem/duração e sigilo/autoria). |
| AUTO-04 | Testes da aplicação | `npm run test --workspace @thats-life/web` | ✅ **1.766 de 1.766** aprovados em **265 de 265** arquivos (incluindo [captureRepository.recusasMigration.test.ts](../apps/web/src/server/persistence/mysql/captureRepository.recusasMigration.test.ts), [viverMaisRodizio.recusa.test.ts](../apps/web/src/server/application/viverMaisRodizio.recusa.test.ts), [route.test.ts](../apps/web/src/app/api/application/triagem/%5Bid%5D/encaminhar/route.test.ts), [historicoCpf.test.ts](../apps/web/src/lib/historicoCpf.test.ts) e [publicBooking.test.ts](../apps/web/src/server/scheduling/publicBooking.test.ts)). |
| AUTO-05 | Build de produção | `npm run web:build` | ⏳ Não reexecutado após este último lote de 3 itens (passou no `npm run check` da rodada anterior com **1.983 testes**). |

---

## 7. Roteiro sugerido de capturas para a apresentação (`output/testes-2026-11-23/capturas/`)

Ordem prática para abrir as telas com **contas e pacientes fictícios**, capturar cada prova visual e anexar na reunião ou atualizar esta tabela para `✅ Conferido (tela)`:

| Ordem | Arquivo sugerido (`.png`) | Perfil / URL | O que deve aparecer visível no print | Situação |
| :---: | --- | --- | --- | --- |
| 1 | `01_vitrine_vocacional_profissional.png` | Público · `/vitrine` | Os dois botões separados: **Orientação Vocacional** e **Orientação Profissional** | ⏳ A capturar |
| 2 | `02_cadastro_17_cursos_duas_pos.png` | Público · `/cadastro-psicologo` (ou aba de cadastro) | Lista com os 17 cursos e 2ª pós somando os serviços/públicos | ⏳ A capturar |
| 3 | `03_psi_meu_cadastro_termo_pdf.png` | Psicólogo · `/meu-cadastro` | Card do Termo de Adesão com botão **Baixar PDF** funcionando | ⏳ A capturar |
| 4 | `04_gestao_termo_aguardando_aprovacao.png` | Gestão · `/gestao/cockpit` (ficha de candidato) | Status `"envio liberado após aprovação"` antes da aprovação e status enviado após aprovar | ⏳ A capturar |
| 5 | `05_gestao_cockpit_rodizio_empate.png` | Gestão · `/gestao/cockpit` (psicólogos) | Posição no rodízio e selo `"empate, decidido por sorteio"` | ⏳ A capturar |
| 6 | `06_gestao_cockpit_escolha_direta_devolver.png` | Gestão · `/gestao/cockpit` (fila de triagem) | Caso de escolha direta pendente + botão **Devolver ao rodízio** | ⏳ A capturar |
| 7 | `07_gestao_cockpit_selo_aceito.png` | Gestão · `/gestao/cockpit` (fila de triagem) | Selo **Aceito** e contador do psicólogo ocupando a vaga imediatamente | ⏳ A capturar |
| 8 | `08_psi_novo_paciente_projeto_acolhe.png` | Psicólogo/Gestão · `/pacientes` (Novo Paciente) | Opção **Projeto Acolhe** marcada e contador de vagas preservado | ⏳ A capturar |
| 9 | `09_gestao_pacientes_vinculo_direto_limite.png` | Gestão · `/gestao/pacientes` ou `/gestao/cockpit` | Gaveta com escolha **Pedir aceite (24h)** / **Vincular diretamente** e alerta de limite `"6 de 5"` com justificativa | ⏳ A capturar |
| 10 | `10_gestao_sino_48h_sem_agendamento.png` | Gestão · Sino de notificações | Alerta de paciente aceito há 48h sem primeiro agendamento | ⏳ A capturar |
| 11 | `11_psi_agenda_orientacao_parental_90min.png` | Psicólogo · `/agenda` (Novo Agendamento) | Serviço **Orientação Parental** com escolha entre **50 min (individual)** e **1h30 (família)** | ⏳ A capturar |
| 12 | `12_link_publico_horarios_servico.png` | Paciente (público) · `/agendar/[token]` | Horários filtrados conforme serviço e público do encaminhamento | ⏳ A capturar |
| 13 | `13_gestao_agenda_filtro_correcao.png` | Gestão · `/gestao/agenda` | Filtro por `Realizada`/`Cancelada` + modal de correção de horário/formato | ⏳ A capturar |
| 14 | `14_psi_prontuario_vinculos_encerrados.png` | Psicólogo · Linha do tempo | Paciente transferido exibindo sigilo (sucessor não vê anterior; autora vê e complementa) | ⏳ A capturar |
| 15 | `15_psi_prontuario_rascunho_ficha.png` | Psicólogo · Linha do tempo | Aviso de rascunho retido na ficha original ao trocar de paciente | ⏳ A capturar |
| 16 | `16_relatorios_declaracao_periodo.png` | Gestão · `/relatorios/declaracao` | Filtro de período (`inicio`/`fim`) aplicado na prévia e emissão | ⏳ A capturar |
| 17 | `17_gestao_e_psi_financeiro_conciliacao.png` | Gestão (`/gestao/financeiro`) e Psicólogo (`/meu-financeiro`) | Mesmo total de créditos educacionais (70%) nos dois painéis | ⏳ A capturar |
| 18 | `18_psi_meu_financeiro_origem_sessao.png` | Psicólogo · `/meu-financeiro` | Coluna **Atendimento / Origem** exibindo serviço + data/hora ou pacote | ⏳ A capturar |
| 19 | `19_psi_sino_cobranca_vencida.png` | Psicólogo · Sino → `/meu-financeiro` | Notificação de cobrança vencida destacando a linha da cobrança na tabela | ⏳ A capturar |
| 20 | `20_financeiro_menu_isolado.png` | Financeiro · `/gestao/financeiro` | Login do perfil Financeiro sem acesso a prontuário e rotas clínicas | ⏳ A capturar |
| 21 | `21_psi_novo_paciente_publico_homologado.png` | Psicólogo · `/pacientes` (Novo Paciente) | Campo "Para quem é o atendimento?" restrito aos públicos homologados do profissional | ⏳ A capturar |
| 22 | `22_recusa_encaminhamento_motivo.png` | Psicólogo · `/confirmar-contato/[id]` | Campo opcional de motivo preenchido antes de recusar o encaminhamento | ⏳ A capturar |
| 23 | `23_gestao_historico_cpf_e_recusas.png` | Gestão · `/gestao/pacientes` (Gaveta) | Painel de histórico administrativo por CPF e motivos de recusa registrados | ⏳ A capturar |

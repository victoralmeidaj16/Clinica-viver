# Testes da plataforma — 28/10/2026

Rodada de aproximadamente cinco minutos, combinando interface publicada e testes automatizados locais. Perfil aberto: Psicólogo Teste. Nenhum paciente, sessão, cobrança ou mensagem real foi criado. Nenhum código foi alterado.

## Resultado

373 testes passaram em 64 arquivos: 308 testes da aplicação nos fluxos principais, 30 do domínio e 35 adicionais de cadastro, CPF, preços e recorrência. Testes com integrações simuladas; isso não certifica a infraestrutura de produção.

## Interface publicada

- Cadastro pelo psicólogo: formulário abre, informa vínculo automático ao perfil e bloqueia envio vazio.
- Serviço: escolher Psicoterapia Individual habilita a modalidade.
- Convênios: selecionar Sim carrega a lista de empresas parceiras.
- Agenda: página e formulário manual abrem; seleção personalizada de três datas atualiza o contador para três sessões. Dias anteriores ficam desabilitados no calendário personalizado.
- Sem pacientes no perfil, a seleção de paciente fica vazia e a confirmação do agendamento permanece desabilitada.
- Disponibilidade: grade e resumo carregam; o formulário de bloqueio impede avançar sem datas.
- Link público: CPF vazio é obrigatório; 000.000.000-00 é rejeitado como inválido.
- Perfil sem sessões: não foi possível executar reagendamento pela interface.

## Inconsistência encontrada

O formulário permite combinar Agendamento Particular com Conveniado = Sim e exibe a seleção de empresa. Entretanto, o código local normaliza o cadastro particular para possuiConvenio = NAO e convenioSelecionado = Nenhum.

Evidências:

- `apps/web/src/components/patients/PatientRegistrationFields.tsx`: campos de convênio disponíveis sem condicionar à modalidade particular.
- `apps/web/src/components/patients/NewPatientModal.tsx`: envio dos campos do formulário sem conversão de modalidade.
- `apps/web/src/lib/triagemSubmissao.ts`: normalização de convênio para Não/Nenhum quando a modalidade contém PARTICULAR.
- `apps/web/src/server/application/patientDirectory.test.ts`: teste “descarta convênio informado quando a modalidade é particular”, aprovado nesta rodada.

Impacto: a interface aceita uma escolha que o código local ignora. A persistência desse caso na versão publicada não foi executada. Ajuste sugerido: alinhar os campos disponíveis à regra de modalidade, deixando explícito quando convênio não se aplica.

## Cobertura automatizada relevante

- Agendamento e reagendamento: ciclo válido, conflito de horários, preservação da sessão original, duração bloqueada, autorização do profissional e isolamento por organização.
- Solicitações de reagendamento: aceite/recusa, pedidos duplicados, sessão alterada e horário ocupado; alteração de sessão e pedido na mesma transação.
- Cadastro: vínculo ao próprio psicólogo, rejeição de outro profissional, repetição idempotente, CPF duplicado, transação atômica e WhatsApp apenas após confirmação da gravação.
- Convênios: permissões administrativas, nomes duplicados, vínculo e cobranças, geração concorrente de boleto e cancelamento condicionado à resposta do provedor.

## Execução e limites

Comandos executados pela raiz, usando Node 22.22.0 disponível no ambiente:

```sh
npm run test --workspace @thats-life/web -- scheduling convenio patientRegistration patientCreation patientPromotion patientDirectory rescheduleRequest agenda
npm run test --workspace @thats-life/core -- scheduling patientHandoff
npm run test --workspace @thats-life/web -- src/lib/manualAppointment.test.ts src/lib/publicBookingRecurrence.test.ts src/lib/bookingDate.test.ts src/server/persistence/mysql/patientCpfUniqueness.test.ts src/server/persistence/mysql/patientCpfUpdate.test.ts src/server/persistence/mysql/patientSessionPricing.test.ts src/server/application/patientFiscalIdentity.test.ts src/server/application/managedPatientRegistration.test.ts src/components/patients/patientSessionPricingView.test.ts
```

A tentativa inicial no Node 24.10.0 encerrou com `SecItemCopyMatching failed -50`; os mesmos testes principais passaram ao utilizar Node 22.22.0. Houve apenas aviso experimental de SQLite nas execuções concluídas.

Salvar paciente dispara WhatsApp, e agendar pode criar cobrança. As gravações completas foram verificadas nos testes isolados, sem acionar provedores reais. Não houve teste ponta a ponta dessas gravações em produção nem acesso administrativo à gestão de convênios. Lint, typecheck e build não foram executados nesta rodada de testes funcionais. Alterações locais preexistentes foram preservadas.

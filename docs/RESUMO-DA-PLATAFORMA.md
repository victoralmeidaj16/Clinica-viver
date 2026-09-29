# Resumo da Plataforma Clínica Viver Mais

A **Clínica Viver Mais — Thats Life (TL-Psi)** é uma plataforma de gestão para clínicas de psicologia e clínicas-escola. Ela centraliza a entrada de pacientes, a distribuição de atendimentos, a agenda dos profissionais, os registros clínicos e o acompanhamento financeiro.

O objetivo é reduzir tarefas administrativas e permitir que psicólogos e gestores acompanhem a jornada do paciente em um único sistema.

## Como funciona na prática

1. **Entrada do paciente:** pela vitrine pública ou pelo cadastro realizado pela equipe, com dados pessoais, contato, serviço desejado, modalidade, convênio e preferência de turno.
2. **Triagem e encaminhamento:** distribuição entre profissionais conforme disponibilidade, perfil de atendimento e capacidade. O fluxo prevê contato em até 24 horas e redistribuição quando necessário.
3. **Agendamento:** o profissional organiza sua disponibilidade e compartilha um link para marcação. A plataforma reúne sessões, bloqueios, reagendamentos e cancelamentos.
4. **Atendimento e registro:** o psicólogo acompanha seus pacientes e registra a evolução clínica, com prontuário estruturado e histórico.
5. **Cobrança e acompanhamento:** os módulos financeiros organizam cobranças, pagamentos e créditos, enquanto a gestão acompanha os indicadores da operação.

## Principais funcionalidades

| Área | Recursos |
|---|---|
| **Cadastro de pacientes** | Dados pessoais e sociais, CPF, endereço com consulta por CEP, contato de emergência, origem do paciente, necessidades e vínculo com convênio. |
| **Serviços** | Psicoterapia individual e de casal, avaliação psicológica e neuropsicológica, orientação profissional e orientação parental, com modalidades sociais e particulares. |
| **Painel do psicólogo** | Carteira de pacientes, próximos atendimentos, calendário, acesso ao histórico e atalhos de comunicação. |
| **Agenda** | Disponibilidade, bloqueios, agendamento por link, recorrência e gestão de alterações das sessões. |
| **Prontuário e histórico** | Registros no formato SOAP — relato, observações, avaliação e plano — com revisão profissional, versionamento e linha do tempo. |
| **Comunicação** | Integração com WhatsApp para triagem, confirmação de contato e avisos relacionados aos atendimentos. |
| **Financeiro** | Cobranças por sessão, links de pagamento, acompanhamento de recebimentos e extrato do profissional. |
| **Clínica-escola** | Regra de divisão de 70% em créditos para o aluno/profissional e 30% para a clínica. O abatimento no curso é realizado pelo setor financeiro. |
| **Gestão de profissionais** | Credenciamento, controle de capacidade, pausa no recebimento de pacientes e visibilidade na vitrine. |
| **Convênios e fiscal** | Cadastro de empresas parceiras, faturamento consolidado e recursos de emissão e consulta de NFS-e. |
| **Documentos acadêmicos** | Certificados com PDF e validação pública por código ou QR Code, além de declaração de horas. |
| **Relatórios** | Fila de triagem, prazo de contato, perfil dos pacientes, origem das demandas, volume de sessões e registros de auditoria. |

## Quem utiliza

- **Pacientes:** acessam a apresentação da clínica, solicitam atendimento, agendam e consultam links de pagamento.
- **Psicólogos:** gerenciam a própria rotina, pacientes, registros e financeiro.
- **Gestores:** acompanham profissionais, capacidade de atendimento, cadastros, finanças e resultados.

## Estágio atual e escopo do resumo

Este resumo foi elaborado em **25 de setembro de 2026**, a partir do código e da documentação do repositório, sem validar a operação em produção.

Existem módulos implementados e integrações que dependem de configuração. A geração de prontuários por IA e a supervisão com anonimização aparecem na proposta documental, mas não tiveram seu funcionamento confirmado nesta análise. Alguns indicadores também estão explicitamente marcados no código como indisponíveis.

## Referências no projeto

- [Apresentação do projeto](../README.md)
- [Documentação de funcionalidades](FUNCIONALIDADES.md)
- [Fluxo de navegação e funcionalidades](fluxo-navegacao-e-funcionalidades.md)
- [Cadastro de pacientes](../apps/web/src/components/patients/patientRegistration.ts)
- [Automação pós-sessão](../apps/web/src/server/application/postSessionService.ts)
- [Indicadores mensais](../apps/web/src/server/application/monthlyIndicators.ts)

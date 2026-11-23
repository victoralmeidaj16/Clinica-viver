# Informativo de verificação — mudanças de 05 a 10/11/2026

Data: 11/11/2026. Escopo: commits `b65557c` a `ab7897b` (branch `main`, sincronizada com `origin/main`).

## Resumo

O código está íntegro e as páginas publicadas respondem como esperado. **Nenhuma tela foi exercitada no navegador**, então o funcionamento visual e os fluxos (agenda, cobrança, convênios, triagem) ainda precisam de conferência manual. O roteiro está no fim.

## O que foi verificado

| Verificação | Resultado |
| --- | --- |
| Lint | Passou |
| Typecheck (core e web) | Passou |
| Testes do core | 195 de 195 passaram |
| Testes do web | 1637 de 1637 passaram (245 arquivos) |
| Build de produção (`web:build`) | Passou |
| `clinicavivermais.cloud` e `app.clinicavivermais.cloud` | Respondem 200 |
| `/api/application/status` (rota removida em `0c0fb33`) | 404 nos dois domínios, ou seja, o código novo está publicado na Vercel e na VPS |
| Rotas protegidas em `app.` (`/agenda`, `/gestao/cockpit`, `/convenios`) | Redirecionam para o login (307) |
| `/api/infra/oci/status` | 401 sem sessão |

Observação: as verificações rodaram com Node 24; o `.nvmrc` pede 20.19.4. Não apareceu problema por isso.

## Situação por mudança

| Mudança | Commit | Código e testes | Publicado | Falta conferir na tela |
| --- | --- | --- | --- | --- |
| Agenda, pagamentos, notificações e rodízio (posição no rodízio, vencimento da cobrança, abas da agenda, resumo de disponibilidade) | `dac3822` | Testes cobrem | Provável (ver nota) | Agenda da gestão, botão de vencimento nos recebíveis, posição do rodízio no card do psicólogo |
| Vencimento unificado e erros internos ocultos no checkout | `0c0fb33` | Testes cobrem | Confirmado em parte (rota removida dá 404) | Modal de vencimento da sessão; mensagem de erro no checkout sem detalhe interno |
| Convênios: revisão de faturas e conciliação protegida | `afbc1fd` | Testes cobrem | Provável | Painel de fatura/NFS-e e fluxo de revisão em Convênios PJ |
| Triagem: protocolos duplicados evitados, código obsoleto removido | `ab7897b` | Testes passam | **Não confirmado** | Criar triagem de teste e ver se o protocolo é único |
| Cadastro de pacientes: acessibilidade; período e origem opcionais | `b65557c`, `b6433ed` | Testes passam | Provável | Cadastro manual sem período e origem |
| Credenciamento e notificação à gestão sobre perfil | `482479c`, `016565c`, `6633e15` | Testes passam | Provável | Troca de pós-graduação e o aviso na gestão |

Nota sobre "publicado": o site na Vercel acompanha o push no `main`, e a VPS só atualiza com deploy manual. O 404 da rota removida em `app.clinicavivermais.cloud` mostra que a VPS já tem pelo menos o commit `0c0fb33`. Não consegui ler o SHA publicado na VPS: o acesso SSH foi bloqueado pelo controle de permissões desta sessão. Por isso `ab7897b` (triagem) não está confirmado como implantado.

## Estado atual da produção (captura da tela admin)

O painel da clínica carregou sem erro visível. A fila de triagem mostra 0 pacientes aguardando, sem profissional e com prazo vencido, e 0 credenciamentos em análise. Há 1 notificação pendente.

## Limitações

- Nenhuma ferramenta de navegador conectada à sessão, então não houve clique em telas.
- Não foram feitos envios de WhatsApp, cobranças, notas fiscais nem criação de dados.
- SHA implantado na VPS não verificado.

## Roteiro de conferência manual (sem efeitos reais)

1. **Agenda da gestão:** abrir, trocar entre as abas, abrir uma sessão e conferir o resumo de disponibilidade.
2. **Gestão de Psicólogos:** conferir a posição no rodízio no card de cada psicólogo.
3. **Financeiro:** abrir o recebível e o modal de vencimento; só olhar, sem salvar e sem gerar cobrança.
4. **Convênios PJ:** abrir uma fatura e o painel de revisão e NFS-e; só olhar, sem emitir.
5. **Triagem:** com a autorização de quem opera a clínica, registrar uma triagem real e conferir o protocolo.
6. **Cadastro manual de paciente:** abrir o formulário e confirmar que período e origem são opcionais e que há campo de acessibilidade; não salvar.
7. **Notificações:** abrir o sino e conferir a notificação pendente.
